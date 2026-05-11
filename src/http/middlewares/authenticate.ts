import jwt from 'jsonwebtoken'
import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JwtPayload {
  adminId: string
  email: string
  organizationId?: string
  emailVerified: boolean
}

declare module 'fastify' {
  interface FastifyRequest {
    admin: JwtPayload
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies.access_token
  if (!token) return reply.code(401).send({ error: 'Unauthorized' })

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload
    request.admin = payload
  } catch {
    return reply.code(401).send({ error: 'Token expired or invalid' })
  }
}

export function isValidAdminCookie(cookies?: { access_token?: string }): boolean {
  const token = cookies?.access_token
  if (!token) return false
  try {
    jwt.verify(token, process.env.JWT_ACCESS_SECRET!)
    return true
  } catch {
    return false
  }
}

export async function requireOrgContext(request: FastifyRequest, reply: FastifyReply) {
  if (!request.admin?.organizationId) {
    return reply.code(403).send({ error: 'No organization context. Call /auth/switch-org first.' })
  }
}
