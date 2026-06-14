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
import type { RenewPassUseCase } from '../../application/pass/useCases/RenewPassUseCase.js'
import type { UnarchivePassUseCase } from '../../application/pass/useCases/UnarchivePassUseCase.js'
import { authenticate, requireOrgContext, isValidAdminRequest } from '../middlewares/authenticate.js'
import { generateGoogleWalletUrl } from '../../infrastructure/google/GoogleWalletService.js'
import { buildStampsHeroImage } from '../../infrastructure/apple/assets/StampsStripGenerator.js'
import type { StampsRules } from '../../domain/wallet/entities/WalletRules.js'
import type { StampsData } from '../../domain/pass/entities/PassData.js'
import { sendWhatsAppRateLimit, daypassScanRateLimit, sendPassLinkRateLimit } from '../plugins/rateLimit.js'
import type { PassRepository } from '../../domain/pass/repository/PassRepository.js'
import type { PlanGuard } from '../middlewares/checkPlan.js'
import { parsePagination } from '../../application/common/Pagination.js'

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
  renewPass: RenewPassUseCase,
  unarchivePass: UnarchivePassUseCase,
) {
  return async (app: FastifyInstance) => {
    // Public — validate short link, always return OG meta HTML with instant JS redirect.
    // Serving HTML for all requests (not just bots) ensures Baileys can fetch OG tags
    // when generating a link preview before sending the WhatsApp message, which makes
    // the link render as a tappable card instead of plain text on the recipient's device.
    app.get('/dl/:token', async (request, reply) => {
      const { token } = request.params as { token: string }
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'

      try {
        const { passToken } = await validateDownloadToken.run(token)
        const destination = `${frontendUrl}/w/${passToken}?dl=${token}`
        const { wallet } = await getPassByToken.run(passToken)
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        const title = esc(`${wallet.businessName} — Tu wallet digital`)
        const description = esc(wallet.description || `Abre tu wallet de ${wallet.businessName}`)
        const image = wallet.logoUrl ? esc(wallet.logoUrl) : ''
        const destEsc = esc(destination)

        return reply
          .type('text/html')
          .send(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
${image ? `<meta property="og:image" content="${image}">` : ''}
<meta property="og:url" content="${destEsc}">
<meta property="og:type" content="website">
<meta http-equiv="refresh" content="0;url=${destEsc}">
</head><body><script>location.href="${destEsc}"</script></body></html>`)
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

    // Public — stamp strip image for Google Wallet heroImage (no PII returned, only PNG)
    app.get('/passes/:token/stamp-strip', async (request, reply) => {
      const { token } = request.params as { token: string }
      try {
        const { pass, wallet } = await getPassByToken.run(token)
        if (wallet.rules.type !== 'stamps') return reply.code(404).send()
        const rules = wallet.rules as StampsRules
        const data = pass.data as StampsData
        const img = buildStampsHeroImage(
          data.currentStamps,
          rules.totalStamps,
          wallet.primaryColor,
          wallet.accentColor,
          rules.stampIcon,
          rules.stampCustomSvg,
        )
        reply.header('Content-Type', 'image/png')
        reply.header('Cache-Control', 'no-cache, no-store')
        reply.send(img)
      } catch {
        reply.code(404).send()
      }
    })

    // Daypass scan — público por diseño (scanner en entrada del evento no tiene sesión).
    // Rate limit agresivo por IP para prevenir invalidación masiva de passes.
    app.post('/passes/scan/:token', { ...daypassScanRateLimit }, async (request, reply) => {
      const { token } = request.params as { token: string }
      await scanDaypass.run({ token })
      reply.send({ ok: true, message: 'Daypass scanned and invalidated' })
    })

    // Protected — admin actions
    app.get('/wallets/:walletId/passes', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { walletId } = request.params as { walletId: string }
      const query = request.query as Record<string, string>
      const status = query.status as 'active' | 'completed' | 'archived' | undefined
      reply.send(await getPassesByWallet.run({
        walletId,
        adminId: request.admin.adminId,
        organizationId: request.admin.organizationId!,
        pagination: parsePagination(query),
        search: query.search,
        status,
      }))
    })

    app.get('/wallets/:walletId/passes/scanned', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { walletId } = request.params as { walletId: string }
      reply.send(await getScannedDaypasses.run({
        walletId,
        adminId: request.admin.adminId,
        organizationId: request.admin.organizationId!,
        pagination: parsePagination(request.query as Record<string, string>),
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

    app.post('/passes/:token/send-link', { ...sendPassLinkRateLimit, preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
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

    app.post('/passes/:token/renew', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { token } = request.params as { token: string }
      reply.code(200).send(await renewPass.run({
        token,
        adminId: request.admin.adminId,
        organizationId: request.admin.organizationId!,
      }))
    })

    app.post('/passes/:token/unarchive', { preHandler: [authenticate, requireOrgContext] }, async (request, reply) => {
      const { token } = request.params as { token: string }
      reply.send(await unarchivePass.run({
        token,
        adminId: request.admin.adminId,
        organizationId: request.admin.organizationId!,
      }))
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
