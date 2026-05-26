import jwt from 'jsonwebtoken'
import { createHash } from 'crypto'

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'none' as const,
  secure: true,
  path: '/',
}

export function signTokens(adminId: string, email: string, organizationId?: string, emailVerified = false) {
  const payload = { adminId, email, emailVerified, ...(organizationId ? { organizationId } : {}) }
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' })
  return { accessToken, refreshToken }
}
