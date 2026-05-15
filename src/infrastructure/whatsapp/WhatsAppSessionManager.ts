import path from 'path'
import { Client, LocalAuth } from 'whatsapp-web.js'
import type { PrismaClient } from '@prisma/client'

// Returns last 4 digits only — enough for debugging, not enough to identify
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `***${digits.slice(-4)}`
}

export type WhatsAppStatus = 'disconnected' | 'qr_pending' | 'connected'

const SEND_COOLDOWN_MS = 5_000
// Auto-destroy the client if QR is not scanned within this time
const QR_SESSION_TIMEOUT_MS = 5 * 60 * 1000
const SESSIONS_DIR = process.env.WHATSAPP_SESSIONS_DIR ?? './whatsapp-sessions'

interface SessionEntry {
  client: Client
  status: WhatsAppStatus
  qr: string | null
  phone: string | null
  lastSentAt: number
  qrTimer: ReturnType<typeof setTimeout> | null
}

export class WhatsAppSessionManager {
  private readonly _sessions = new Map<string, SessionEntry>()

  constructor(private readonly _db: PrismaClient) {}

  async restoreAll(): Promise<void> {
    const rows = await this._db.whatsAppSession.findMany()
    // Restore sequentially to avoid spawning all Chrome instances at once
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
      await entry.client.logout().catch(() => {})
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

    // Validates the number against WhatsApp servers and returns the correct
    // chat ID, handling country-specific quirks (e.g. Mexico's dropped '1' prefix)
    const numberId = await entry.client.getNumberId(digits)
    if (!numberId) {
      throw new Error(`WhatsApp: number ${maskPhone(digits)} is not registered on WhatsApp`)
    }

    await entry.client.sendMessage(numberId._serialized, text)
    console.log(`[WhatsApp] Message sent OK to ${maskPhone(digits)}`)
  }

  private async _connect(orgId: string): Promise<void> {
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: orgId,
        dataPath: path.resolve(SESSIONS_DIR),
      }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      },
      // Give slower servers more time to load WhatsApp Web
      authTimeoutMs: 60_000,
    })

    const entry: SessionEntry = {
      client,
      status: 'qr_pending',
      qr: null,
      phone: null,
      lastSentAt: 0,
      qrTimer: null,
    }
    this._sessions.set(orgId, entry)

    client.on('qr', (qr) => {
      entry.qr = qr
      entry.status = 'qr_pending'
      console.log(`[WhatsApp] org=${orgId} QR ready`)

      // Reset the QR timeout every time a new QR is emitted
      if (entry.qrTimer) clearTimeout(entry.qrTimer)
      entry.qrTimer = setTimeout(() => {
        if (entry.status === 'qr_pending') {
          console.log(`[WhatsApp] org=${orgId} QR timeout — destroying client`)
          this._destroyEntry(orgId)
        }
      }, QR_SESSION_TIMEOUT_MS)
    })

    client.on('ready', async () => {
      if (entry.qrTimer) {
        clearTimeout(entry.qrTimer)
        entry.qrTimer = null
      }
      entry.status = 'connected'
      entry.qr = null
      const phone = client.info?.wid?.user ?? null
      entry.phone = phone
      console.log(`[WhatsApp] org=${orgId} connected as ${phone ? maskPhone(phone) : 'unknown'}`)

      await this._db.whatsAppSession.upsert({
        where: { organizationId: orgId },
        create: { organizationId: orgId, phone },
        update: { phone },
      }).catch(err => console.error(`[WhatsApp] db upsert failed org=${orgId}`, err))
    })

    client.on('auth_failure', (msg) => {
      console.error(`[WhatsApp] org=${orgId} auth failure: ${msg}`)
      this._destroyEntry(orgId)
    })

    client.on('disconnected', async (reason) => {
      console.log(`[WhatsApp] org=${orgId} disconnected: ${reason}`)

      if (reason === 'LOGOUT') {
        // User removed this linked device from their phone — clean everything
        await this._destroyEntry(orgId)
        await this._db.whatsAppSession.deleteMany({ where: { organizationId: orgId } })
          .catch(() => {})
      } else {
        // Transient disconnect (network, server restart) — reconnect automatically
        entry.status = 'disconnected'
        setTimeout(() => {
          if (this._sessions.get(orgId)?.status === 'disconnected') {
            this._connect(orgId).catch(err =>
              console.error(`[WhatsApp] reconnect failed org=${orgId}`, err),
            )
          }
        }, 5_000)
      }
    })

    // initialize() starts Chrome; events fire asynchronously after
    await client.initialize().catch(err => {
      console.error(`[WhatsApp] initialize failed org=${orgId}`, err)
      this._destroyEntry(orgId)
    })
  }

  private async _destroyEntry(orgId: string): Promise<void> {
    const entry = this._sessions.get(orgId)
    if (!entry) return
    if (entry.qrTimer) clearTimeout(entry.qrTimer)
    this._sessions.delete(orgId)
    await entry.client.destroy().catch(() => {})
  }
}
