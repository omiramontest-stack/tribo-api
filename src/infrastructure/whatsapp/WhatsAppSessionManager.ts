import pino from 'pino'
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import type { PrismaClient } from '@prisma/client'
import { useDbAuthState } from './dbAuthState.js'
import { logger } from '../logger/logger.js'

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `***${digits.slice(-4)}`
}

export type WhatsAppStatus = 'disconnected' | 'qr_pending' | 'connected' | 'failed'

type SSESubscriber = (event: string, data: object) => void

const SEND_COOLDOWN_MS = 5_000
const QR_SESSION_TIMEOUT_MS = 5 * 60 * 1000

// Stop reconnecting after this many consecutive failures to prevent
// infinite key generation and memory accumulation.
const MAX_RECONNECT_ATTEMPTS = 8

// Exponential backoff: 5s → 10s → 20s → 40s → 60s (max), ±25% jitter
const RECONNECT_BASE_MS = 5_000
const RECONNECT_MAX_MS = 60_000
function reconnectDelay(attempt: number): number {
  const exp = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS)
  const jitter = exp * 0.25 * (Math.random() * 2 - 1)
  return Math.round(exp + jitter)
}

// Cache the WhatsApp Web version — it only changes when WhatsApp releases
// an update. Re-fetching on every reconnect hits GitHub and wastes time.
let _cachedVersion: [number, number, number] | null = null
let _versionFetchedAt = 0
const VERSION_TTL_MS = 60 * 60 * 1000 // 1 hour

async function getWaVersion(): Promise<[number, number, number]> {
  if (_cachedVersion && Date.now() - _versionFetchedAt < VERSION_TTL_MS) {
    return _cachedVersion
  }
  const { version } = await fetchLatestBaileysVersion()
  _cachedVersion = version as [number, number, number]
  _versionFetchedAt = Date.now()
  return _cachedVersion
}

interface SessionEntry {
  sock: WASocket
  status: WhatsAppStatus
  qr: string | null
  phone: string | null
  lastSentAt: number
  qrTimer: ReturnType<typeof setTimeout> | null
  reconnectAttempt: number
  flushAll: () => Promise<void>
}

export class WhatsAppSessionManager {
  private readonly _sessions = new Map<string, SessionEntry>()
  private readonly _subscribers = new Map<string, Set<SSESubscriber>>()

  constructor(private readonly _db: PrismaClient) {}

  // ── SSE pub/sub ─────────────────────────────────────────────────────────────

  subscribe(orgId: string, fn: SSESubscriber): () => void {
    if (!this._subscribers.has(orgId)) this._subscribers.set(orgId, new Set())
    this._subscribers.get(orgId)!.add(fn)
    return () => { this._subscribers.get(orgId)?.delete(fn) }
  }

  private _emit(orgId: string, event: string, data: object): void {
    this._subscribers.get(orgId)?.forEach(fn => {
      try { fn(event, data) } catch { /* subscriber disconnected */ }
    })
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async restoreAll(): Promise<void> {
    const rows = await this._db.whatsAppSession.findMany()
    // Restore concurrently but cap parallelism to avoid bursting connections.
    const CONCURRENCY = 3
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      await Promise.allSettled(
        rows.slice(i, i + CONCURRENCY).map(row =>
          this._connect(row.organizationId).catch(err =>
            logger.error({ err, orgId: row.organizationId }, '[WhatsApp] restore failed'),
          ),
        ),
      )
    }
  }

  async destroyAll(): Promise<void> {
    const orgIds = [...this._sessions.keys()]
    await Promise.all(orgIds.map(id => this._destroyEntry(id)))
  }

  getStatus(orgId: string): WhatsAppStatus {
    return this._sessions.get(orgId)?.status ?? 'disconnected'
  }

  getQR(orgId: string): string | null {
    return this._sessions.get(orgId)?.qr ?? null
  }

  getPhone(orgId: string): string | null {
    return this._sessions.get(orgId)?.phone ?? null
  }

  async connect(orgId: string): Promise<void> {
    const existing = this._sessions.get(orgId)
    if (existing && existing.status !== 'disconnected' && existing.status !== 'failed') return
    // Reset reconnect counter on manual connect so the user can always retry.
    if (existing) existing.reconnectAttempt = 0
    await this._connect(orgId)
  }

  async disconnect(orgId: string): Promise<void> {
    const entry = this._sessions.get(orgId)
    if (entry) {
      await entry.sock.logout().catch(() => {})
      await this._destroyEntry(orgId)
    }
    await this._db.whatsAppSession.deleteMany({ where: { organizationId: orgId } })
  }

  async sendMessage(orgId: string, to: string, text: string): Promise<void> {
    const entry = this._sessions.get(orgId)
    if (!entry || entry.status !== 'connected') {
      throw new Error('WhatsApp not connected for this organization')
    }

    const now = Date.now()
    if (now - entry.lastSentAt < SEND_COOLDOWN_MS) {
      throw new Error(`WhatsApp: wait ${SEND_COOLDOWN_MS / 1000}s between sends`)
    }
    entry.lastSentAt = now

    const digits = to.replace(/\D/g, '')
    logger.info({ phone: maskPhone(digits) }, '[WhatsApp] resolving number')

    const results = await entry.sock.onWhatsApp(digits)
    const result = results?.[0]
    if (!result?.exists) {
      throw new Error(`WhatsApp: number ${maskPhone(digits)} is not registered on WhatsApp`)
    }

    await entry.sock.sendMessage(result.jid, { text })
    logger.info({ phone: maskPhone(digits) }, '[WhatsApp] message sent OK')
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async _connect(orgId: string): Promise<void> {
    const { state, saveCreds, flushAll } = await useDbAuthState(orgId, this._db)
    const version = await getWaVersion()

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: ['Tribo', 'Chrome', '120.0'],
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      maxMsgRetryCount: 0,
      getMessage: async () => undefined,
      // Don't cache group metadata — reduces memory footprint significantly
      cachedGroupMetadata: async () => undefined,
      // Reduce retry overhead for a send-only use case
      transactionOpts: { maxCommitRetries: 1, delayBetweenTriesMs: 500 },
    })

    const entry: SessionEntry = {
      sock,
      status: 'qr_pending',
      qr: null,
      phone: null,
      lastSentAt: 0,
      qrTimer: null,
      reconnectAttempt: 0,
      flushAll,
    }
    this._sessions.set(orgId, entry)

    sock.ev.on('creds.update', () => {
      saveCreds().catch(err => logger.error({ err, orgId }, '[WhatsApp] saveCreds failed'))
    })

    sock.ev.on('connection.update', (update) => {
      this._handleConnectionUpdate(orgId, entry, sock, update).catch(err =>
        logger.error({ err, orgId }, '[WhatsApp] connection.update handler failed'),
      )
    })
  }

  private async _handleConnectionUpdate(
    orgId: string,
    entry: SessionEntry,
    sock: SessionEntry['sock'],
    update: { connection?: string; lastDisconnect?: { error?: unknown }; qr?: string },
  ): Promise<void> {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      entry.qr = qr
      entry.status = 'qr_pending'
      logger.info({ orgId }, '[WhatsApp] QR ready')
      this._emit(orgId, 'qr', { qr })

      if (entry.qrTimer) clearTimeout(entry.qrTimer)
      entry.qrTimer = setTimeout(() => {
        if (entry.status === 'qr_pending') {
          logger.info({ orgId }, '[WhatsApp] QR timeout — destroying')
          this._emit(orgId, 'disconnected', {})
          this._destroyEntry(orgId).catch(err =>
            logger.error({ err, orgId }, '[WhatsApp] destroyEntry on QR timeout failed'),
          )
        }
      }, QR_SESSION_TIMEOUT_MS)
    }

    if (connection === 'open') {
      if (entry.qrTimer) { clearTimeout(entry.qrTimer); entry.qrTimer = null }
      entry.status = 'connected'
      entry.qr = null
      entry.reconnectAttempt = 0
      const phone = sock.user?.id?.split(':')[0] ?? null
      entry.phone = phone
      logger.info({ orgId, phone: phone ? maskPhone(phone) : 'unknown' }, '[WhatsApp] connected')
      this._emit(orgId, 'connected', { phone })

      await this._db.whatsAppSession.upsert({
        where: { organizationId: orgId },
        create: { organizationId: orgId, phone },
        update: { phone },
      }).catch(err => logger.error({ err, orgId }, '[WhatsApp] db upsert failed'))
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
      logger.info({ orgId, statusCode }, '[WhatsApp] disconnected')

      if (statusCode === DisconnectReason.loggedOut) {
        this._emit(orgId, 'disconnected', {})
        await this._destroyEntry(orgId)
        await Promise.all([
          this._db.whatsAppSession.deleteMany({ where: { organizationId: orgId } }),
          this._db.whatsAppAuthCreds.deleteMany({ where: { organizationId: orgId } }),
          this._db.whatsAppAuthKey.deleteMany({ where: { organizationId: orgId } }),
        ]).catch(() => {})
        return
      }

      // Permanent errors: don't reconnect, let the user re-initiate manually.
      const permanentErrors = new Set([
        DisconnectReason.forbidden,
        DisconnectReason.badSession,
      ])
      if (statusCode && permanentErrors.has(statusCode)) {
        entry.status = 'failed'
        this._emit(orgId, 'failed', { reason: 'permanent_error', statusCode })
        logger.warn({ orgId, statusCode }, '[WhatsApp] permanent disconnect — not reconnecting')
        await this._destroyEntry(orgId)
        return
      }

      // Give up after MAX_RECONNECT_ATTEMPTS to prevent infinite key generation.
      if (entry.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
        entry.status = 'failed'
        this._emit(orgId, 'failed', { reason: 'max_reconnects_reached' })
        logger.warn({ orgId, attempts: entry.reconnectAttempt }, '[WhatsApp] max reconnects reached — giving up')
        await this._destroyEntry(orgId)
        return
      }

      entry.status = 'disconnected'
      const delay = reconnectDelay(entry.reconnectAttempt++)
      this._emit(orgId, 'reconnecting', { delayMs: delay, attempt: entry.reconnectAttempt })
      logger.info({ orgId, attempt: entry.reconnectAttempt, delayMs: delay }, '[WhatsApp] scheduling reconnect')

      setTimeout(() => {
        if (this._sessions.get(orgId)?.status === 'disconnected') {
          this._connect(orgId).catch(err =>
            logger.error({ err, orgId }, '[WhatsApp] reconnect failed'),
          )
        }
      }, delay)
    }
  }

  private async _destroyEntry(orgId: string): Promise<void> {
    const entry = this._sessions.get(orgId)
    if (!entry) return
    if (entry.qrTimer) clearTimeout(entry.qrTimer)
    this._sessions.delete(orgId)
    await entry.flushAll().catch(() => {})
    await entry.sock.end(undefined).catch(() => {})
  }
}
