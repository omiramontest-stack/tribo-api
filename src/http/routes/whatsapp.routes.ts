import type { FastifyInstance } from 'fastify'
import type { WhatsAppSessionManager } from '../../infrastructure/whatsapp/WhatsAppSessionManager.js'
import type { OrganizationRepository } from '../../domain/organization/repository/OrganizationRepository.js'
import type { SseTokenStore } from '../../infrastructure/whatsapp/SseTokenStore.js'
import { authenticate } from '../middlewares/authenticate.js'
import {
  whatsappConnectRateLimit,
  whatsappStatusRateLimit,
} from '../plugins/rateLimit.js'

// ── Helpers de autorización ───────────────────────────────────────────────────

function requireAdminOrOwner(orgRepo: OrganizationRepository) {
  return async (request: Parameters<typeof authenticate>[0], reply: Parameters<typeof authenticate>[1]) => {
    const { id } = request.params as { id: string }
    const role = await orgRepo.getMemberRole(request.admin.adminId, id)
    if (!role || role === 'staff') return reply.code(403).send({ error: 'FORBIDDEN' })
  }
}

function requireMember(orgRepo: OrganizationRepository) {
  return async (request: Parameters<typeof authenticate>[0], reply: Parameters<typeof authenticate>[1]) => {
    const { id } = request.params as { id: string }
    const isMember = await orgRepo.isMember(request.admin.adminId, id)
    if (!isMember) return reply.code(403).send({ error: 'FORBIDDEN' })
  }
}

// ── Allowlist de orígenes CORS ────────────────────────────────────────────────

function resolveAllowedOrigin(requestOrigin: string | undefined): string {
  const allowed = (process.env.CLIENT_URL ?? 'http://localhost:5173')
    .split(',')
    .map(o => o.trim())
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin
  return allowed[0] // fallback al primer origen permitido; nunca refleja uno arbitrario
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function whatsappRoutes(
  manager: WhatsAppSessionManager,
  orgRepo: OrganizationRepository,
  sseTokenStore: SseTokenStore,
) {
  return async (app: FastifyInstance) => {

    /**
     * Emite un token efímero (60s, one-shot) para autenticar el SSE.
     * El JWT de sesión NO debe ir como query param (queda en logs de servidor,
     * proxies, browser history y cabecera Referer).
     */
    app.post('/organizations/:id/whatsapp/stream-token', {
      preHandler: [authenticate, requireMember(orgRepo)],
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      const token = sseTokenStore.issue(request.admin.adminId, id)
      // TTL corto: el frontend debe abrir el SSE inmediatamente después
      reply.send({ token, expiresInSeconds: 60 })
    })

    /**
     * SSE stream — recibe eventos qr/connected/disconnected en tiempo real.
     * Autenticación: one-time token efímero obtenido de /stream-token (query param ?t=).
     * EventSource no puede enviar headers custom, de ahí el query param —
     * pero el token dura sólo 60s y es de uso único, minimizando la ventana de abuso.
     */
    app.get('/organizations/:id/whatsapp/stream', {
      ...whatsappStatusRateLimit,
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      const rawToken = (request.query as Record<string, string>).t
      if (!rawToken) return reply.code(401).send({ error: 'Unauthorized' })

      // Consumir el token: one-shot, expira en 60s
      const entry = sseTokenStore.consume(rawToken)
      if (!entry) return reply.code(401).send({ error: 'Token expired or invalid' })

      // Verificar que el token fue emitido para esta organización
      if (entry.orgId !== id) return reply.code(403).send({ error: 'FORBIDDEN' })

      // CORS: validar el Origin contra la allowlist, nunca reflejar uno arbitrario
      const safeOrigin = resolveAllowedOrigin(request.headers.origin)

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': safeOrigin,
        'Access-Control-Allow-Credentials': 'true',
      })
      reply.raw.flushHeaders()

      const send = (event: string, data: object) => {
        try {
          reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        } catch { /* client disconnected */ }
      }

      // Estado actual para que el cliente sincronice al conectar/reconectar
      send('status', { status: manager.getStatus(id), phone: manager.getPhone(id) })
      const currentQr = manager.getQR(id)
      if (currentQr) send('qr', { qr: currentQr })

      const unsubscribe = manager.subscribe(id, send)

      // Keep-alive para sortear el timeout de 60s de Railway/nginx
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

    // Iniciar conexión — genera el QR; el cliente lo recibe por SSE
    app.post('/organizations/:id/whatsapp/connect', {
      ...whatsappConnectRateLimit,
      preHandler: [authenticate, requireAdminOrOwner(orgRepo)],
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      await manager.connect(id)
      reply.send({ status: manager.getStatus(id) })
    })

    // Estado puntual — para la carga inicial antes de que el SSE conecte
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

    // Desconectar y eliminar sesión
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
