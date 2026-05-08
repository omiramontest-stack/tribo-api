import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { authenticate, requireOrgContext } from '../middlewares/authenticate.js'
import type { GetBillingStatusUseCase } from '../../application/billing/useCases/GetBillingStatusUseCase.js'
import type { CreateCheckoutSessionUseCase } from '../../application/billing/useCases/CreateCheckoutSessionUseCase.js'
import type { BuyCreditsUseCase } from '../../application/billing/useCases/BuyCreditsUseCase.js'
import type { HandleStripeWebhookUseCase } from '../../application/billing/useCases/HandleStripeWebhookUseCase.js'
import type { BillingRepository } from '../../domain/billing/repository/BillingRepository.js'
import type { StripeService } from '../../infrastructure/billing/stripe/StripeService.js'

const checkoutSchema = z.object({
  planSlug: z.enum(['base', 'pro']),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
})

const buyCreditsSchema = z.object({
  packId: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
})

export function billingRoutes(
  getBillingStatus: GetBillingStatusUseCase,
  createCheckout: CreateCheckoutSessionUseCase,
  buyCredits: BuyCreditsUseCase,
  handleWebhook: HandleStripeWebhookUseCase,
  billingRepo: BillingRepository,
  stripeService: StripeService,
) {
  return async (app: FastifyInstance) => {
    // Webhook en scope aislado para capturar raw body
    app.register(async (webhookScope) => {
      webhookScope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => {
        done(null, body)
      })

      webhookScope.post('/billing/webhook', async (request, reply) => {
        const signature = request.headers['stripe-signature'] as string
        if (!signature) return reply.code(400).send({ error: 'Missing stripe-signature' })
        await handleWebhook.run(request.body as Buffer, signature)
        reply.send({ received: true })
      })
    })

    // Rutas autenticadas
    app.register(async (authed) => {
      authed.addHook('preHandler', authenticate)
      authed.addHook('preHandler', requireOrgContext)

      authed.get('/billing/status', async (request, reply) => {
        reply.send(await getBillingStatus.run(request.admin.organizationId!))
      })

      authed.get('/billing/plans', async (_request, reply) => {
        reply.send(await billingRepo.findAllActivePlans())
      })

      authed.get('/billing/sms-packs', async (_request, reply) => {
        reply.send(await billingRepo.findAllActivePacks())
      })

      authed.post('/billing/checkout', async (request, reply) => {
        const body = checkoutSchema.safeParse(request.body)
        if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })
        reply.send(await createCheckout.run({
          ...body.data,
          organizationId: request.admin.organizationId!,
          adminId: request.admin.adminId,
        }))
      })

      authed.post('/billing/buy-credits', async (request, reply) => {
        const body = buyCreditsSchema.safeParse(request.body)
        if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })
        reply.send(await buyCredits.run({
          ...body.data,
          organizationId: request.admin.organizationId!,
        }))
      })

      authed.post('/billing/portal', async (request, reply) => {
        const returnUrl = (request.body as { returnUrl?: string })?.returnUrl ?? process.env.FRONTEND_URL ?? '/'
        const subscription = await billingRepo.findSubscriptionByOrg(request.admin.organizationId!)
        if (!subscription?.stripeCustomerId) {
          return reply.code(404).send({ error: 'NO_CUSTOMER', message: 'No Stripe customer found' })
        }
        const url = await stripeService.createBillingPortalSession(subscription.stripeCustomerId, returnUrl)
        reply.send({ url })
      })
    })
  }
}
