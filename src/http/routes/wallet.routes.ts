import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { CreateWalletUseCase } from '../../application/wallet/useCases/CreateWalletUseCase.js'
import type { GetWalletsUseCase } from '../../application/wallet/useCases/GetWalletsUseCase.js'
import type { GetWalletByIdUseCase } from '../../application/wallet/useCases/GetWalletByIdUseCase.js'
import type { DeleteWalletUseCase } from '../../application/wallet/useCases/DeleteWalletUseCase.js'
import { authenticate } from '../middlewares/authenticate.js'

const rulesSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('stamps'), totalStamps: z.number().int().min(1), reward: z.string() }),
  z.object({ type: z.literal('membership'), level: z.string(), expiresInDays: z.number().int().nullable() }),
  z.object({ type: z.literal('points'), pointsLabel: z.string(), reward: z.string(), rewardThreshold: z.number().int().min(1) }),
])

const createSchema = z.object({
  type: z.enum(['stamps', 'membership', 'points']),
  businessName: z.string().min(1),
  logoUrl: z.string().url().nullable().optional(),
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
) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', authenticate)

    app.get('/wallets', async (_req, reply) => {
      reply.send(await getWallets.run())
    })

    app.get('/wallets/:id', async (request, reply) => {
      const { id } = request.params as { id: string }
      reply.send(await getWalletById.run(id))
    })

    app.post('/wallets', async (request, reply) => {
      const body = createSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })
      reply.code(201).send(await createWallet.run(body.data))
    })

    app.delete('/wallets/:id', async (request, reply) => {
      const { id } = request.params as { id: string }
      await deleteWallet.run(id)
      reply.code(204).send()
    })
  }
}
