import type { FastifyInstance } from 'fastify'
import type { WhatsAppSessionManager } from '../../infrastructure/whatsapp/WhatsAppSessionManager.js'
import type { OrganizationRepository } from '../../domain/organization/repository/OrganizationRepository.js'
import { authenticate } from '../middlewares/authenticate.js'
import {
  whatsappConnectRateLimit,
  whatsappQrRateLimit,
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
    // Start connection — returns immediately, client polls for QR
    app.post('/organizations/:id/whatsapp/connect', {
      ...whatsappConnectRateLimit,
      preHandler: [authenticate, requireAdminOrOwner(orgRepo)],
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      await manager.connect(id)
      reply.send({ status: manager.getStatus(id) })
    })

    // Poll this endpoint every 3s while status is qr_pending
    app.get('/organizations/:id/whatsapp/qr', {
      ...whatsappQrRateLimit,
      preHandler: [authenticate, requireAdminOrOwner(orgRepo)],
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      const qr = manager.getQR(id)
      const status = manager.getStatus(id)
      if (!qr && status !== 'qr_pending') {
        return reply.code(404).send({ error: 'NO_QR_AVAILABLE' })
      }
      reply.send({ qr })
    })

    // Status endpoint — { status, phone }
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
