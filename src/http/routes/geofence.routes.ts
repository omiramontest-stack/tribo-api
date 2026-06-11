import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { GetGeofencesUseCase } from '../../application/wallet/useCases/GetGeofencesUseCase.js'
import type { CreateGeofenceUseCase } from '../../application/wallet/useCases/CreateGeofenceUseCase.js'
import type { UpdateGeofenceUseCase } from '../../application/wallet/useCases/UpdateGeofenceUseCase.js'
import type { DeleteGeofenceUseCase } from '../../application/wallet/useCases/DeleteGeofenceUseCase.js'
import { authenticate, requireOrgContext } from '../middlewares/authenticate.js'

const scheduleWindowSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:mm'),
}).refine(w => w.startTime < w.endTime, { message: 'endTime must be after startTime' })

const createSchema = z.object({
  label: z.string().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(10).max(100).optional(),
  message: z.string().min(1).max(200),
  scheduleEnabled: z.boolean().optional(),
  schedule: z.array(scheduleWindowSchema).max(10).optional(),
  timezone: z.string().min(1).optional(),
})

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().int().min(10).max(100).optional(),
  message: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
  scheduleEnabled: z.boolean().optional(),
  schedule: z.array(scheduleWindowSchema).max(10).optional(),
  timezone: z.string().min(1).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

export function geofenceRoutes(
  getGeofences: GetGeofencesUseCase,
  createGeofence: CreateGeofenceUseCase,
  updateGeofence: UpdateGeofenceUseCase,
  deleteGeofence: DeleteGeofenceUseCase,
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

      const body = createSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      reply.code(201).send(
        await createGeofence.run({
          ...body.data,
          walletId,
          organizationId: request.admin.organizationId!,
          adminId: request.admin.adminId,
        }),
      )
    })

    app.patch('/organizations/:orgId/wallets/:walletId/geofences/:id', async (request, reply) => {
      const { orgId, id } = request.params as { orgId: string; walletId: string; id: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

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
