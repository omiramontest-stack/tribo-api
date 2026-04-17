import jwt from 'jsonwebtoken'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { LoginUseCase } from '../../application/auth/useCases/LoginUseCase.js'
import { authenticate } from '../middlewares/authenticate.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
}

function signTokens(adminId: string, email: string) {
  const accessToken = jwt.sign({ adminId, email }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  const refreshToken = jwt.sign({ adminId, email }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' })
  return { accessToken, refreshToken }
}

export function authRoutes(loginUseCase: LoginUseCase) {
  return async (app: FastifyInstance) => {
    app.post('/auth/login', async (request, reply) => {
      const body = loginSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const admin = await loginUseCase.run(body.data)
      const { accessToken, refreshToken } = signTokens(admin.id, admin.email)

      reply
        .setCookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 60 * 15 })
        .setCookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 })
        .send({ admin })
    })

    app.post('/auth/refresh', async (request, reply) => {
      const token = request.cookies.refresh_token
      if (!token) return reply.code(401).send({ error: 'No refresh token' })

      try {
        const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { adminId: string; email: string }
        const { accessToken } = signTokens(payload.adminId, payload.email)
        reply
          .setCookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 60 * 15 })
          .send({ ok: true })
      } catch {
        reply.code(401).send({ error: 'Invalid refresh token' })
      }
    })

    app.post('/auth/logout', { preHandler: authenticate }, async (_request, reply) => {
      reply
        .clearCookie('access_token', { path: '/' })
        .clearCookie('refresh_token', { path: '/' })
        .send({ ok: true })
    })

    app.get('/auth/me', { preHandler: authenticate }, async (request, reply) => {
      reply.send({ admin: request.admin })
    })
  }
}
