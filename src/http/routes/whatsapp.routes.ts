import jwt from 'jsonwebtoken'
import type { FastifyInstance } from 'fastify'
import type { WhatsAppSessionManager } from '../../infrastructure/whatsapp/WhatsAppSessionManager.js'
import type { OrganizationRepository } from '../../domain/organization/repository/OrganizationRepository.js'
import type { JwtPayload } from '../middlewares/authenticate.js'
import { authenticate } from '../middlewares/authenticate.js'
import {
  whatsappConnectRateLimit,
  whatsappStatusRateLimit,
} from '../plugins/rateLimit.js'

function requireAdminOrOwner(orgRepo: OrganizationRepository) {
  return async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const role = await orgRepo.getMemberRole(request.admin.adminId, id)
    if (!role || role === 'staff') return reply.code(403).send({ error: 'FORBIDDEN' })
  }
}

function requireMember(orgRepo: OrganizationRepository) {
  return async (request: any, reply: any) => {
    const { id } = request.params as { id: string }
    const isMember = await orgRepo.isMember(request.admin.adminId, id)
    if (!isMember) return reply.code(403).send({ error: 'FORBIDDEN' })
  }
}

export function whatsappRoutes(manager: WhatsAppSessionManager, orgRepo: OrganizationRepository) {
  return async (app: FastifyInstance) => {

    // SSE stream — real-time push of qr/connected/disconnected events
    app.get('/organizations/:id/whatsapp/stream', {
      ...whatsappStatusRateLimit,
    }, async (request, reply) => {
      // EventSource can't send custom headers, so we accept token as query param
      const { id } = request.params as { id: string }
      const token = (request.query as Record<string, string>).token
      if (!token) return reply.code(401).send({ error: 'Unauthorized' })

      let payload: JwtPayload
      try {
        payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload
      } catch {
        return reply.code(401).send({ error: 'Token expired or invalid' })
      }

      const isMember = await orgRepo.isMember(payload.adminId, id)
      if (!isMember) return reply.code(403).send({ error: 'FORBIDDEN' })

      const origin = request.headers.origin ?? process.env.FRONTEND_URL ?? '*'
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      })
      reply.raw.flushHeaders()

      const send = (event: string, data: object) => {
        try {
          reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        } catch { /* client disconnected */ }
      }

      // Push current state immediately so the client is in sync on connect/reconnect
      send('status', { status: manager.getStatus(id), phone: manager.getPhone(id) })
      const currentQr = manager.getQR(id)
      if (currentQr) send('qr', { qr: currentQr })

      const unsubscribe = manager.subscribe(id, send)

      // Keep connection alive through Railway's 60s proxy timeout
      const keepAlive = setInterval(() => {
        try { reply.raw.write(': ping\n\n') } catch { /* ignore */ }
      }, 25_000)

      await new Promise<void>(resolve => {
        request.raw.on('close', resolve)
        request.raw.on('error', resolve)
      })

      clearInterval(keepAlive)
      unsubscribe()
    })

    // Start connection — triggers QR generation, client gets it via SSE stream
    app.post('/organizations/:id/whatsapp/connect', {
      ...whatsappConnectRateLimit,
      preHandler: [authenticate, requireAdminOrOwner(orgRepo)],
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      await manager.connect(id)
      reply.send({ status: manager.getStatus(id) })
    })

    // Status endpoint — kept for initial page load before SSE connects
    app.get('/organizations/:id/whatsapp/status', {
      ...whatsappStatusRateLimit,
      preHandler: [authenticate, requireMember(orgRepo)],
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      reply.send({
        status: manager.getStatus(id),
        phone: manager.getPhone(id),
      })
    })

    // Disconnect and delete session
    app.delete('/organizations/:id/whatsapp/disconnect', {
      ...whatsappConnectRateLimit,
      preHandler: [authenticate, requireAdminOrOwner(orgRepo)],
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      await manager.disconnect(id)
      reply.send({ ok: true })
    })
  }
}
