import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { GeneratePassUseCase } from '../../application/pass/useCases/GeneratePassUseCase.js'
import type { GetPassByTokenUseCase } from '../../application/pass/useCases/GetPassByTokenUseCase.js'
import type { GetPassesByWalletUseCase } from '../../application/pass/useCases/GetPassesByWalletUseCase.js'
import type { UpdatePassDataUseCase } from '../../application/pass/useCases/UpdatePassDataUseCase.js'
import type { DeletePassUseCase } from '../../application/pass/useCases/DeletePassUseCase.js'
import type { ScanDaypassUseCase } from '../../application/pass/useCases/ScanDaypassUseCase.js'
import type { GetCashbackTransactionsUseCase } from '../../application/cashback/useCases/GetCashbackTransactionsUseCase.js'
import type { GetScannedDaypassesUseCase } from '../../application/pass/useCases/GetScannedDaypassesUseCase.js'
import type { SendPassLinkUseCase } from '../../application/pass/useCases/SendPassLinkUseCase.js'
import type { SendPassWhatsAppUseCase } from '../../application/pass/useCases/SendPassWhatsAppUseCase.js'
import type { ValidateDownloadTokenUseCase } from '../../application/pass/useCases/ValidateDownloadTokenUseCase.js'
import { authenticate, requireOrgContext, isValidAdminRequest } from '../middlewares/authenticate.js'
import { generateGoogleWalletUrl } from '../../infrastructure/google/GoogleWalletService.js'
import { sendWhatsAppRateLimit } from '../plugins/rateLimit.js'
import type { PassRepository } from '../../domain/pass/repository/PassRepository.js'
import type { PlanGuard } from '../middlewares/checkPlan.js'

const generateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  photoUrl: z.string().url().optional(),
})

const updateSchema = z.object({
  action: z.enum(['add_stamp', 'add_points', 'renew_membership', 'add_cashback', 'subtract_cashback', 'use_bundle', 'add_giftcard', 'subtract_giftcard', 'redeem_coupon']),
  amount: z.number().int().positive().optional(),
  purchaseAmount: z.number().positive().optional(),
  cashbackPercent: z.number().positive().max(100).optional(),
  description: z.string().optional(),
})

export function passRoutes(
  generatePass: GeneratePassUseCase,
  getPassByToken: GetPassByTokenUseCase,
  getPassesByWallet: GetPassesByWalletUseCase,
  updatePassData: UpdatePassDataUseCase,
  deletePass: DeletePassUseCase,
  scanDaypass: ScanDaypassUseCase,
  getCashbackTransactions: GetCashbackTransactionsUseCase,
  getScannedDaypasses: GetScannedDaypassesUseCase,
  sendPassLink: SendPassLinkUseCase,
  validateDownloadToken: ValidateDownloadTokenUseCase,
  passRepo: PassRepository,
  planGuard: PlanGuard,
  sendPassWhatsApp: SendPassWhatsAppUseCase,
) {
  return async (app: FastifyInstance) => {
    // Public — validate short link, redirect to frontend with dl token as query param
    app.get('/dl/:token', async (request, reply) => {
      const { token } = request.params as { token: string }
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
      try {
        const { passToken } = await validateDownloadToken.run(token)
        reply.redirect(`${frontendUrl}/w/${passToken}?dl=${token}`)
      } catch {
        reply.redirect(`${frontendUrl}/link-expirado`)
      }
    })

    // Semi-public — requires admin session OR valid dl token
    app.get('/passes/w/:token', async (request, reply) => {
      const { token } = request.params as { token: string }
      const dlToken = (request.query as { dl?: string }).dl

      if (dlToken) {
        const { expiresAt } = await validateDownloadToken.run(dlToken)
        const pass = await getPassByToken.run(token)
        return reply.send({ ...pass, dlExpiresAt: expiresAt })
      }

      if (!isValidAdminRequest(request)) return reply.code(401).send({ error: 'UNAUTHORIZED' })

      reply.send(await getPassByToken.run(token))
    })

    // Public — daypass scan (called by scanner at event entrance)
    app.post('/passes/scan/:token', async (request, reply) => {
      const { token } = request.params as { token: string }
      await scanDaypass.run({ token })
      reply.send({ ok: true, message: 'Daypass scanned and invalidated' })
    })

    // Protected — admin actions
    app.get('/wallets/:walletId/passes', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { walletId } = request.params as { walletId: string }
      const { page = '1', limit = '20' } = request.query as { page?: string; limit?: string }
      reply.send(await getPassesByWallet.run({
        walletId,
        adminId: request.admin.adminId,
        organizationId: request.admin.organizationId!,
        pagination: { page: Number(page), limit: Number(limit) },
      }))
    })

    app.get('/wallets/:walletId/passes/scanned', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { walletId } = request.params as { walletId: string }
      const { page = '1', limit = '20' } = request.query as { page?: string; limit?: string }
      reply.send(await getScannedDaypasses.run({
        walletId,
        adminId: request.admin.adminId,
        organizationId: request.admin.organizationId!,
        pagination: { page: Number(page), limit: Number(limit) },
      }))
    })

    app.post('/wallets/:walletId/passes', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { walletId } = request.params as { walletId: string }
      const body = generateSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const orgId = request.admin.organizationId!
      const currentCount = await passRepo.countByOrganizationId(orgId)
      const { allowed, max } = await planGuard.checkPassLimit(orgId, currentCount)
      if (!allowed) {
        return reply.code(403).send({
          error: 'PASS_LIMIT_REACHED',
          message: max !== null ? `Your plan allows up to ${max} passes` : 'Pass limit reached',
        })
      }

      reply.code(201).send(await generatePass.run({ walletId, adminId: request.admin.adminId, organizationId: orgId, ...body.data }))
    })

    app.patch('/passes/:token', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { token } = request.params as { token: string }
      const body = updateSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })
      reply.send(await updatePassData.run({ token, adminId: request.admin.adminId, organizationId: request.admin.organizationId!, ...body.data }))
    })

    app.get('/passes/:token/transactions', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { token } = request.params as { token: string }
      reply.send(await getCashbackTransactions.run({ token, adminId: request.admin.adminId, organizationId: request.admin.organizationId! }))
    })

    app.post('/passes/:token/send-link', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { token } = request.params as { token: string }
      await sendPassLink.run({ token, adminId: request.admin.adminId, organizationId: request.admin.organizationId! })
      reply.send({ ok: true })
    })

    app.post('/passes/:token/send-whatsapp', { ...sendWhatsAppRateLimit, preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { token } = request.params as { token: string }
      await sendPassWhatsApp.run({
        token,
        adminId: request.admin.adminId,
        organizationId: request.admin.organizationId!,
      })
      reply.send({ ok: true })
    })

    app.delete('/passes/:token', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { token } = request.params as { token: string }
      await deletePass.run({ token, adminId: request.admin.adminId, organizationId: request.admin.organizationId! })
      reply.code(204).send()
    })

    app.get('/passes/:token/google-wallet-url', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { token } = request.params as { token: string }
      const { pass, wallet } = await getPassByToken.run(token)
      const url = await generateGoogleWalletUrl(wallet, pass)
      reply.send({ url })
    })
  }
}
