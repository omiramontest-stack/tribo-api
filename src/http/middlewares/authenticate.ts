import jwt from 'jsonwebtoken'
import type { FastifyRequest, FastifyReply } from 'fastify'

export interface JwtPayload {
  adminId: string
  email: string
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
