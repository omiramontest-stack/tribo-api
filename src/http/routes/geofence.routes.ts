import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { GetGeofencesUseCase } from '../../application/wallet/useCases/GetGeofencesUseCase.js'
import type { CreateGeofenceUseCase } from '../../application/wallet/useCases/CreateGeofenceUseCase.js'
import type { UpdateGeofenceUseCase } from '../../application/wallet/useCases/UpdateGeofenceUseCase.js'
import type { DeleteGeofenceUseCase } from '../../application/wallet/useCases/DeleteGeofenceUseCase.js'
import type { PlanGuard } from '../middlewares/checkPlan.js'
import { authenticate, requireOrgContext } from '../middlewares/authenticate.js'

const createSchema = z.object({
  label: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(100).max(5000).optional(),
  message: z.string().min(1).max(200),
})

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().int().min(100).max(5000).optional(),
  message: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

export function geofenceRoutes(
  getGeofences: GetGeofencesUseCase,
  createGeofence: CreateGeofenceUseCase,
  updateGeofence: UpdateGeofenceUseCase,
  deleteGeofence: DeleteGeofenceUseCase,
  planGuard: PlanGuard,
) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', authenticate)
    app.addHook('preHandler', requireOrgContext)

    app.get('/organizations/:orgId/wallets/:walletId/geofences', async (request, reply) => {
      const { orgId, walletId } = request.params as { orgId: string; walletId: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      reply.send(await getGeofences.run({
        walletId,
        organizationId: request.admin.organizationId!,
        adminId: request.admin.adminId,
      }))
    })

    app.post('/organizations/:orgId/wallets/:walletId/geofences', async (request, reply) => {
      const { orgId, walletId } = request.params as { orgId: string; walletId: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      const { allowed, limit } = await planGuard.checkGeofenceLimit(request.admin.organizationId!)
      if (!allowed) {
        return reply.code(403).send({
          error: 'PLAN_UPGRADE_REQUIRED',
          message: 'Your plan does not include location-based notifications',
        })
      }

      const body = createSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      reply.code(201).send(
        await createGeofence.run({
          ...body.data,
          walletId,
          organizationId: request.admin.organizationId!,
          adminId: request.admin.adminId,
          geofencesLimit: limit,
        }),
      )
    })

    app.patch('/organizations/:orgId/wallets/:walletId/geofences/:id', async (request, reply) => {
      const { orgId, id } = request.params as { orgId: string; walletId: string; id: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      const { allowed } = await planGuard.checkGeofenceLimit(request.admin.organizationId!)
      if (!allowed) {
        return reply.code(403).send({
          error: 'PLAN_UPGRADE_REQUIRED',
          message: 'Your plan does not include location-based notifications',
        })
      }

      const body = updateSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      reply.send(
        await updateGeofence.run({
          id,
          organizationId: request.admin.organizationId!,
          adminId: request.admin.adminId,
          ...body.data,
        }),
      )
    })

    app.delete('/organizations/:orgId/wallets/:walletId/geofences/:id', async (request, reply) => {
      const { orgId, id } = request.params as { orgId: string; walletId: string; id: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      await deleteGeofence.run({
        id,
        organizationId: request.admin.organizationId!,
        adminId: request.admin.adminId,
      })
      reply.code(204).send()
    })
  }
}
