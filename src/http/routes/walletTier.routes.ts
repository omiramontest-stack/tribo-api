import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { ListWalletTiersUseCase } from '../../application/wallet/useCases/ListWalletTiersUseCase.js'
import type { CreateWalletTierUseCase } from '../../application/wallet/useCases/CreateWalletTierUseCase.js'
import type { UpdateWalletTierUseCase } from '../../application/wallet/useCases/UpdateWalletTierUseCase.js'
import type { DeleteWalletTierUseCase } from '../../application/wallet/useCases/DeleteWalletTierUseCase.js'
import { authenticate, requireOrgContext } from '../middlewares/authenticate.js'
import { rulesSchema, themeSchema } from './wallet.routes.js'

// Regla de desbloqueo de un nivel — unión discriminada, lista para nuevos tipos.
const upgradeRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cycles_completed'), threshold: z.number().int().min(1) }),
])

const createSchema = z.object({
  level: z.number().int().min(2),
  name: z.string().min(1).max(100),
  rules: rulesSchema,
  config: themeSchema.nullable().optional(),
  unlockRule: upgradeRuleSchema,
})

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  rules: rulesSchema.optional(),
  config: themeSchema.nullable().optional(),
  unlockRule: upgradeRuleSchema.optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

export function walletTierRoutes(
  listTiers: ListWalletTiersUseCase,
  createTier: CreateWalletTierUseCase,
  updateTier: UpdateWalletTierUseCase,
  deleteTier: DeleteWalletTierUseCase,
) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', authenticate)
    app.addHook('preHandler', requireOrgContext)

    app.get('/organizations/:orgId/wallets/:walletId/tiers', async (request, reply) => {
      const { orgId, walletId } = request.params as { orgId: string; walletId: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      reply.send(await listTiers.run({
        walletId,
        organizationId: request.admin.organizationId!,
        adminId: request.admin.adminId,
      }))
    })

    app.post('/organizations/:orgId/wallets/:walletId/tiers', async (request, reply) => {
      const { orgId, walletId } = request.params as { orgId: string; walletId: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      const body = createSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      reply.code(201).send(
        await createTier.run({
          ...body.data,
          walletId,
          organizationId: request.admin.organizationId!,
          adminId: request.admin.adminId,
        }),
      )
    })

    app.patch('/organizations/:orgId/wallets/:walletId/tiers/:id', async (request, reply) => {
      const { orgId, id } = request.params as { orgId: string; walletId: string; id: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      const body = updateSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      reply.send(
        await updateTier.run({
          id,
          organizationId: request.admin.organizationId!,
          adminId: request.admin.adminId,
          ...body.data,
        }),
      )
    })

    app.delete('/organizations/:orgId/wallets/:walletId/tiers/:id', async (request, reply) => {
      const { orgId, id } = request.params as { orgId: string; walletId: string; id: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      await deleteTier.run({
        id,
        organizationId: request.admin.organizationId!,
        adminId: request.admin.adminId,
      })
      reply.code(204).send()
    })
  }
}
