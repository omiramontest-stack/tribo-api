import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { GeneratePassUseCase } from '../../application/pass/useCases/GeneratePassUseCase.js'
import type { GetPassByTokenUseCase } from '../../application/pass/useCases/GetPassByTokenUseCase.js'
import type { GetPassesByWalletUseCase } from '../../application/pass/useCases/GetPassesByWalletUseCase.js'
import type { UpdatePassDataUseCase } from '../../application/pass/useCases/UpdatePassDataUseCase.js'
import { authenticate } from '../middlewares/authenticate.js'

const generateSchema = z.object({ customerName: z.string().min(1) })

const updateSchema = z.object({
  action: z.enum(['add_stamp', 'add_points', 'renew_membership']),
  amount: z.number().int().positive().optional(),
})

export function passRoutes(
  generatePass: GeneratePassUseCase,
  getPassByToken: GetPassByTokenUseCase,
  getPassesByWallet: GetPassesByWalletUseCase,
  updatePassData: UpdatePassDataUseCase,
) {
  return async (app: FastifyInstance) => {
    // Public — customer wallet view
    app.get('/passes/w/:token', async (request, reply) => {
      const { token } = request.params as { token: string }
      reply.send(await getPassByToken.run(token))
    })

    // Protected — admin actions
    app.get('/wallets/:walletId/passes', { preHandler: authenticate }, async (request, reply) => {
      const { walletId } = request.params as { walletId: string }
      reply.send(await getPassesByWallet.run(walletId))
    })

    app.post('/wallets/:walletId/passes', { preHandler: authenticate }, async (request, reply) => {
      const { walletId } = request.params as { walletId: string }
      const body = generateSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })
      reply.code(201).send(await generatePass.run({ walletId, customerName: body.data.customerName }))
    })

    app.patch('/passes/:token', { preHandler: authenticate }, async (request, reply) => {
      const { token } = request.params as { token: string }
      const body = updateSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })
      reply.send(await updatePassData.run({ token, ...body.data }))
    })
  }
}
