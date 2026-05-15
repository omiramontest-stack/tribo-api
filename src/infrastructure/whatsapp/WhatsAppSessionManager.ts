import { existsSync, mkdirSync, rmSync } from 'fs'
import path from 'path'
import pino from 'pino'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
} from '@whiskeysockets/baileys'
import type { PrismaClient } from '@prisma/client'

export type WhatsAppStatus = 'disconnected' | 'qr_pending' | 'connected'

const SEND_COOLDOWN_MS = 5_000

interface SessionEntry {
  sock: WASocket
  status: WhatsAppStatus
  qr: string | null
  phone: string | null
  lastSentAt: number
}

const SESSIONS_DIR = process.env.WHATSAPP_SESSIONS_DIR ?? './whatsapp-sessions'

function sessionDir(orgId: string): string {
  return path.join(SESSIONS_DIR, orgId)
}

export class WhatsAppSessionManager {
  private readonly _sessions = new Map<string, SessionEntry>()

  constructor(private readonly _db: PrismaClient) {}

  // Called once on server startup to restore existing sessions
  async restoreAll(): Promise<void> {
    const rows = await this._db.whatsAppSession.findMany()
    await Promise.all(rows.map(r => this._connect(r.organizationId).catch(() => {})))
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
      entry.sock.end(undefined)
      this._sessions.delete(orgId)
    }
    const dir = sessionDir(orgId)
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
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

    let digits = to.replace(/\D/g, '')
    // Mexico: WhatsApp dropped the '1' mobile prefix after 2021.
    // +52 1 XXX XXX XXXX (13 digits) → 52 XXX XXX XXXX (12 digits)
    if (digits.length === 13 && digits.startsWith('521')) {
      digits = '52' + digits.slice(3)
    }
    const jid = `${digits}@s.whatsapp.net`

    console.log(`[WhatsApp] Sending to JID: ${jid}`)

    const result = await entry.sock.sendMessage(jid, { text })

    if (!result) {
      throw new Error(`WhatsApp: message to ${jid} was not delivered (sendMessage returned undefined — number may not have WhatsApp)`)
    }

    console.log(`[WhatsApp] Message sent OK, id: ${result.key?.id}`)
  }

  private async _connect(orgId: string): Promise<void> {
    const dir = sessionDir(orgId)
    mkdirSync(dir, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(dir)

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'warn' }),
    })

    const entry: SessionEntry = { sock, status: 'qr_pending', qr: null, phone: null, lastSentAt: 0 }
    this._sessions.set(orgId, entry)

    sock.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
      if (qr) {
        entry.qr = qr
        entry.status = 'qr_pending'
        console.log(`[WhatsApp] org=${orgId} QR updated`)
      }

      if (connection === 'open') {
        entry.status = 'connected'
        entry.qr = null
        const phone = sock.user?.id?.split(':')[0] ?? null
        entry.phone = phone
        console.log(`[WhatsApp] org=${orgId} connected as ${phone}`)

        await this._db.whatsAppSession.upsert({
          where: { organizationId: orgId },
          create: { organizationId: orgId, phone },
          update: { phone },
        })
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
        const loggedOut = statusCode === DisconnectReason.loggedOut
        console.log(`[WhatsApp] org=${orgId} connection closed — statusCode=${statusCode} loggedOut=${loggedOut}`)

        if (loggedOut) {
          this._sessions.delete(orgId)
          const dir = sessionDir(orgId)
          if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
          await this._db.whatsAppSession.deleteMany({ where: { organizationId: orgId } })
        } else {
          entry.status = 'disconnected'
          if (statusCode !== 403) {
            setTimeout(() => this._connect(orgId).catch(err => console.error(`[WhatsApp] reconnect failed org=${orgId}`, err)), 5_000)
          }
        }
      }
    })

    sock.ev.on('creds.update', saveCreds)
  }
}
