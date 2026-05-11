import jwt from 'jsonwebtoken'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { LoginUseCase } from '../../application/auth/useCases/LoginUseCase.js'
import type { RegisterUseCase } from '../../application/auth/useCases/RegisterUseCase.js'
import type { GoogleAuthUseCase } from '../../application/auth/useCases/GoogleAuthUseCase.js'
import type { OnboardingUseCase } from '../../application/auth/useCases/OnboardingUseCase.js'
import type { SendVerificationEmailUseCase } from '../../application/auth/useCases/SendVerificationEmailUseCase.js'
import type { VerifyEmailUseCase } from '../../application/auth/useCases/VerifyEmailUseCase.js'
import type { OrganizationRepository } from '../../domain/organization/repository/OrganizationRepository.js'
import { authenticate } from '../middlewares/authenticate.js'
import { signTokens, COOKIE_OPTS } from '../utils/tokens.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const onboardingSchema = z.object({
  organizationName: z.string().min(1),
  industry: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  logoUrl: z.string().url().optional(),
})


const switchOrgSchema = z.object({
  organizationId: z.string().min(1),
})

export function authRoutes(
  loginUseCase: LoginUseCase,
  registerUseCase: RegisterUseCase,
  googleAuthUseCase: GoogleAuthUseCase,
  onboardingUseCase: OnboardingUseCase,
  orgRepository: OrganizationRepository,
  sendVerificationEmail: SendVerificationEmailUseCase,
  verifyEmail: VerifyEmailUseCase,
) {
  return async (app: FastifyInstance) => {
    app.post('/auth/register', async (request, reply) => {
      const body = registerSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const admin = await registerUseCase.run(body.data)
      const { accessToken, refreshToken } = signTokens(admin.id, admin.email, undefined, admin.emailVerified)

      reply
        .setCookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 60 * 15 })
        .setCookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 })
        .code(201)
        .send({ admin })
    })

    app.post('/auth/onboarding', { preHandler: authenticate }, async (request, reply) => {
      const body = onboardingSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const organization = await onboardingUseCase.run({ adminId: request.admin.adminId, ...body.data })

      sendVerificationEmail.run({ adminId: request.admin.adminId, email: request.admin.email }).catch((err) => {
        app.log.error(err, 'Failed to send verification email after onboarding')
      })

      reply.code(201).send({ organization })
    })

    app.post('/auth/verify-email/:token', async (request, reply) => {
      const { token } = request.params as { token: string }

      const admin = await verifyEmail.run(token)
      const { accessToken, refreshToken } = signTokens(admin.id, admin.email, request.admin?.organizationId, true)

      reply
        .setCookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 60 * 15 })
        .setCookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 })
        .send({ ok: true })
    })

    app.post('/auth/resend-verification', { preHandler: authenticate }, async (request, reply) => {
      await sendVerificationEmail.run({ adminId: request.admin.adminId, email: request.admin.email })
      reply.send({ ok: true })
    })

    app.post('/auth/login', async (request, reply) => {
      const body = loginSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const admin = await loginUseCase.run(body.data)
      const { accessToken, refreshToken } = signTokens(admin.id, admin.email, undefined, admin.emailVerified)

      reply
        .setCookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 60 * 15 })
        .setCookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 })
        .send({ admin })
    })

    app.post('/auth/switch-org', { preHandler: authenticate }, async (request, reply) => {
      const body = switchOrgSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const isMember = await orgRepository.isMember(request.admin.adminId, body.data.organizationId)
      if (!isMember) return reply.code(403).send({ error: 'Forbidden' })

      const { accessToken, refreshToken } = signTokens(request.admin.adminId, request.admin.email, body.data.organizationId, request.admin.emailVerified)
      reply
        .setCookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 60 * 15 })
        .setCookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 })
        .send({ ok: true })
    })

    app.post('/auth/refresh', async (request, reply) => {
      const token = request.cookies.refresh_token
      if (!token) return reply.code(401).send({ error: 'No refresh token' })

      try {
        const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as { adminId: string; email: string; organizationId?: string; emailVerified?: boolean }
        const { accessToken } = signTokens(payload.adminId, payload.email, payload.organizationId, payload.emailVerified ?? false)
        reply
          .setCookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 60 * 15 })
          .send({ ok: true })
      } catch {
        reply.code(401).send({ error: 'Invalid refresh token' })
      }
    })

    app.post('/auth/logout', { preHandler: authenticate }, async (_request, reply) => {
      reply
        .clearCookie('access_token', { ...COOKIE_OPTS, maxAge: 0 })
        .clearCookie('refresh_token', { ...COOKIE_OPTS, maxAge: 0 })
        .send({ ok: true })
    })

    app.get('/auth/me', { preHandler: authenticate }, async (request, reply) => {
      reply.send({ admin: request.admin })
    })

    app.get('/auth/google', async (_request, reply) => {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
      })
      reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
    })

    app.get('/auth/google/callback', async (request, reply) => {
      const { code } = request.query as { code?: string }
      if (!code) return reply.code(400).send({ error: 'Missing code' })

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
          grant_type: 'authorization_code',
        }),
      })

      const tokens = await tokenRes.json() as { id_token?: string; access_token?: string; error?: string; error_description?: string }
      if (tokens.error || !tokens.id_token) {
        app.log.error({ googleError: tokens.error, description: tokens.error_description }, 'Google token exchange failed')
        return reply.code(401).send({ error: 'Google auth failed', detail: tokens.error, description: tokens.error_description })
      }

      const payload = jwt.decode(tokens.id_token) as { sub: string; email: string; name: string } | null
      if (!payload) return reply.code(401).send({ error: 'Invalid Google token' })

      const admin = await googleAuthUseCase.run({
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
      })

      const { accessToken, refreshToken } = signTokens(admin.id, admin.email, undefined, admin.emailVerified)

      const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:5173').split(',')[0].trim()

      reply
        .setCookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 60 * 15 })
        .setCookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 })
        .redirect(clientUrl)
    })
  }
}
