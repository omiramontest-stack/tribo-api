import jwt from 'jsonwebtoken'
import { createHash } from 'crypto'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

const isProd = process.env.NODE_ENV === 'production'

export const COOKIE_OPTS = {
  httpOnly: true,
  // En producción: sameSite=none + secure=true para cookies cross-origin sobre HTTPS.
  // En desarrollo: sameSite=lax + secure=false para que funcionen sobre HTTP/ngrok
  // sin que el browser las bloquee o ignore cuando cambia el túnel.
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProd,
  path: '/',
}

export function signTokens(adminId: string, email: string, organizationId?: string, emailVerified = false) {
  const payload = { adminId, email, emailVerified, ...(organizationId ? { organizationId } : {}) }
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' })
  return { accessToken, refreshToken }
}
