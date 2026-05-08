import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { CreateWalletUseCase } from '../../application/wallet/useCases/CreateWalletUseCase.js'
import type { GetWalletsUseCase } from '../../application/wallet/useCases/GetWalletsUseCase.js'
import type { GetWalletByIdUseCase } from '../../application/wallet/useCases/GetWalletByIdUseCase.js'
import type { DeleteWalletUseCase } from '../../application/wallet/useCases/DeleteWalletUseCase.js'
import type { WalletRepository } from '../../domain/wallet/repository/WalletRepository.js'
import { authenticate, requireOrgContext } from '../middlewares/authenticate.js'
import type { PlanGuard } from '../middlewares/checkPlan.js'

const rulesSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stamps'), totalStamps: z.number().int().min(1), reward: z.string() }),
  z.object({ type: z.literal('membership'), level: z.string(), expiresInDays: z.number().int().nullable() }),
  z.object({ type: z.literal('points'), pointsLabel: z.string(), reward: z.string(), rewardThreshold: z.number().int().min(1) }),
  z.object({ type: z.literal('cashback'), cashbackPercent: z.number().positive().max(100), currency: z.string().min(1) }),
  z.object({ type: z.literal('daypass'), eventName: z.string().min(1), eventDate: z.string().min(1), venue: z.string().min(1), imageUrl: z.string().url().nullable().optional().transform(v => v ?? null) }),
  z.object({ type: z.literal('bundle'), totalUses: z.number().int().min(1), label: z.string().min(1) }),
  z.object({ type: z.literal('giftcard'), initialBalance: z.number().positive(), currency: z.string().min(1) }),
  z.object({ type: z.literal('coupon'), discount: z.number().positive(), discountType: z.enum(['percent', 'fixed']), currency: z.string().optional(), expiresInDays: z.number().int().nullable() }),
])

const createSchema = z.object({
  type: z.enum(['stamps', 'membership', 'points', 'cashback', 'daypass', 'bundle', 'giftcard', 'coupon']),
  businessName: z.string().min(1),
  logoUrl: z.string().url().or(z.literal('')).nullable().optional(),
  primaryColor: z.string(),
  accentColor: z.string(),
  description: z.string(),
  rules: rulesSchema,
})

export function walletRoutes(
  createWallet: CreateWalletUseCase,
  getWallets: GetWalletsUseCase,
  getWalletById: GetWalletByIdUseCase,
  deleteWallet: DeleteWalletUseCase,
  walletRepo: WalletRepository,
  planGuard: PlanGuard,
) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', authenticate)
    app.addHook('preHandler', requireOrgContext)

    app.get('/organizations/:orgId/wallets', async (request, reply) => {
      const { orgId } = request.params as { orgId: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })
      reply.send(await getWallets.run({ organizationId: request.admin.organizationId!, adminId: request.admin.adminId }))
    })

    app.get('/organizations/:orgId/wallets/:id', async (request, reply) => {
      const { orgId, id } = request.params as { orgId: string; id: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })
      reply.send(await getWalletById.run({ id, adminId: request.admin.adminId, organizationId: request.admin.organizationId! }))
    })

    app.post('/organizations/:orgId/wallets', async (request, reply) => {
      const { orgId } = request.params as { orgId: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      const body = createSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const currentCount = await walletRepo.countByOrganizationId(request.admin.organizationId!)
      const { allowed, max } = await planGuard.checkWalletLimit(request.admin.organizationId!, currentCount)
      if (!allowed) {
        return reply.code(403).send({
          error: 'WALLET_LIMIT_REACHED',
          message: `Your plan allows up to ${max} wallet${max === 1 ? '' : 's'}`,
        })
      }

      reply.code(201).send(
        await createWallet.run({ ...body.data, organizationId: request.admin.organizationId!, adminId: request.admin.adminId }),
      )
    })

    app.delete('/organizations/:orgId/wallets/:id', async (request, reply) => {
      const { orgId, id } = request.params as { orgId: string; id: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })
      await deleteWallet.run({ id, adminId: request.admin.adminId, organizationId: request.admin.organizationId! })
      reply.code(204).send()
    })
  }
}
