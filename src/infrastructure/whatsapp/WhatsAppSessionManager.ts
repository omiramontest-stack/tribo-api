import pino from 'pino'
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import type { PrismaClient } from '@prisma/client'
import { useDbAuthState } from './dbAuthState.js'

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `***${digits.slice(-4)}`
}

export type WhatsAppStatus = 'disconnected' | 'qr_pending' | 'connected'

type SSESubscriber = (event: string, data: object) => void

const SEND_COOLDOWN_MS = 5_000
const QR_SESSION_TIMEOUT_MS = 5 * 60 * 1000

interface SessionEntry {
  sock: WASocket
  status: WhatsAppStatus
  qr: string | null
  phone: string | null
  lastSentAt: number
  qrTimer: ReturnType<typeof setTimeout> | null
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
    for (const row of rows) {
      await this._connect(row.organizationId).catch(err =>
        console.error(`[WhatsApp] restore failed org=${row.organizationId}`, err),
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
    if (existing && existing.status !== 'disconnected') return
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
    console.log(`[WhatsApp] Resolving number: ${maskPhone(digits)}`)

    const results = await entry.sock.onWhatsApp(digits)
    const result = results?.[0]
    if (!result?.exists) {
      throw new Error(`WhatsApp: number ${maskPhone(digits)} is not registered on WhatsApp`)
    }

    await entry.sock.sendMessage(result.jid, { text })
    console.log(`[WhatsApp] Message sent OK to ${maskPhone(digits)}`)
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private async _connect(orgId: string): Promise<void> {
    const { state, saveCreds } = await useDbAuthState(orgId, this._db)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: ['Tribo', 'Chrome', '120.0'],
      generateHighQualityLinkPreview: false,
    })

    const entry: SessionEntry = {
      sock,
      status: 'qr_pending',
      qr: null,
      phone: null,
      lastSentAt: 0,
      qrTimer: null,
    }
    this._sessions.set(orgId, entry)

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        entry.qr = qr
        entry.status = 'qr_pending'
        console.log(`[WhatsApp] org=${orgId} QR ready`)
        this._emit(orgId, 'qr', { qr })

        if (entry.qrTimer) clearTimeout(entry.qrTimer)
        entry.qrTimer = setTimeout(() => {
          if (entry.status === 'qr_pending') {
            console.log(`[WhatsApp] org=${orgId} QR timeout — destroying`)
            this._emit(orgId, 'disconnected', {})
            this._destroyEntry(orgId)
          }
        }, QR_SESSION_TIMEOUT_MS)
      }

      if (connection === 'open') {
        if (entry.qrTimer) { clearTimeout(entry.qrTimer); entry.qrTimer = null }
        entry.status = 'connected'
        entry.qr = null
        const phone = sock.user?.id?.split(':')[0] ?? null
        entry.phone = phone
        console.log(`[WhatsApp] org=${orgId} connected as ${phone ? maskPhone(phone) : 'unknown'}`)
        this._emit(orgId, 'connected', { phone })

        await this._db.whatsAppSession.upsert({
          where: { organizationId: orgId },
          create: { organizationId: orgId, phone },
          update: { phone },
        }).catch(err => console.error(`[WhatsApp] db upsert failed org=${orgId}`, err))
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
        console.log(`[WhatsApp] org=${orgId} disconnected: ${statusCode}`)

        if (statusCode === DisconnectReason.loggedOut) {
          this._emit(orgId, 'disconnected', {})
          await this._destroyEntry(orgId)
          await Promise.all([
            this._db.whatsAppSession.deleteMany({ where: { organizationId: orgId } }),
            this._db.whatsAppAuthCreds.deleteMany({ where: { organizationId: orgId } }),
            this._db.whatsAppAuthKey.deleteMany({ where: { organizationId: orgId } }),
          ]).catch(() => {})
        } else {
          entry.status = 'disconnected'
          this._emit(orgId, 'reconnecting', {})
          setTimeout(() => {
            if (this._sessions.get(orgId)?.status === 'disconnected') {
              this._connect(orgId).catch(err =>
                console.error(`[WhatsApp] reconnect failed org=${orgId}`, err),
              )
            }
          }, 5_000)
        }
      }
    })
  }

  private async _destroyEntry(orgId: string): Promise<void> {
    const entry = this._sessions.get(orgId)
    if (!entry) return
    if (entry.qrTimer) clearTimeout(entry.qrTimer)
    this._sessions.delete(orgId)
    await entry.sock.end(undefined).catch(() => {})
  }
}
