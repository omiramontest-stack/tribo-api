import { randomBytes } from 'crypto'

interface SseTokenEntry {
  adminId: string
  orgId: string
  expiresAt: number
}

const TTL_MS = 60_000 // 60 segundos

/**
 * Store en-proceso de tokens efímeros para el SSE de WhatsApp.
 * Evita exponer el JWT de sesión como query param (visible en logs de servidor,
 * proxies, browser history y cabecera Referer).
 *
 * Ciclo de vida:
 *   1. POST /organizations/:id/whatsapp/stream-token  →  genera token, lo almacena 60s
 *   2. GET  /organizations/:id/whatsapp/stream?t=<token>  →  consume el token (one-shot)
 */
export class SseTokenStore {
  private readonly _tokens = new Map<string, SseTokenEntry>()

  /** Genera un token efímero y lo registra. Devuelve el token. */
  issue(adminId: string, orgId: string): string {
    this._purgeExpired()
    const token = randomBytes(32).toString('hex')
    this._tokens.set(token, { adminId, orgId, expiresAt: Date.now() + TTL_MS })
    return token
  }

  /**
   * Valida y consume el token (one-shot).
   * Devuelve la entrada si es válida, null si expiró o no existe.
   */
  consume(token: string): SseTokenEntry | null {
    const entry = this._tokens.get(token)
    if (!entry) return null
    this._tokens.delete(token) // one-shot — inmediatamente inválido
    if (Date.now() > entry.expiresAt) return null
    return entry
  }

  private _purgeExpired(): void {
    const now = Date.now()
    for (const [token, entry] of this._tokens) {
      if (now > entry.expiresAt) this._tokens.delete(token)
    }
  }
}
