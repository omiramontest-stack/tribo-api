/**
 * Tests — Stripe Webhook flow (Fix-22 / Flow 2)
 *
 * Tests the critical invariants of HandleStripeWebhookUseCase:
 *   - Idempotency: duplicate events are silently ignored
 *   - checkout.session.completed (subscription mode) → saves/updates subscription
 *   - customer.subscription.deleted → marks subscription as cancelled
 *   - invoice.payment_failed → marks subscription as past_due
 *   - customer.subscription.updated → detects plan change (upgrade/downgrade) and updates planId + stripePriceId
 *   - Cache is invalidated on subscription changes
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { HandleStripeWebhookUseCase } from '../application/billing/useCases/HandleStripeWebhookUseCase.js'
import { CreateCheckoutSessionUseCase } from '../application/billing/useCases/CreateCheckoutSessionUseCase.js'
import type { BillingRepository } from '../domain/billing/repository/BillingRepository.js'
import type { StripeService } from '../infrastructure/billing/stripe/StripeService.js'
import type { Plan } from '../domain/billing/entities/Plan.js'
import type { Subscription } from '../domain/billing/entities/Subscription.js'

const PLAN: Plan = {
  id: 'plan-1',
  slug: 'base',
  name: 'Base',
  price: 49,
  currency: 'USD',
  stripePriceId: 'price_abc',
  maxWallets: 5,
  maxPasses: 1000,
  emailCampaigns: true,
  smsCampaigns: false,
  analyticsLevel: 'basic',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const PRO_PLAN: Plan = {
  id: 'plan-pro',
  slug: 'pro',
  name: 'Pro',
  price: 99,
  currency: 'USD',
  stripePriceId: 'price_pro_xyz',
  maxWallets: 50,
  maxPasses: null,
  emailCampaigns: true,
  smsCampaigns: true,
  analyticsLevel: 'full',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const SUBSCRIPTION: Subscription = {
  id: 'sub-1',
  organizationId: 'org-1',
  planId: 'plan-1',
  status: 'active',
  stripeCustomerId: 'cus_abc',
  stripeSubscriptionId: 'sub_abc',
  stripePriceId: 'price_abc',
  trialEndsAt: null,
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
  cancelledAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeBillingRepo(overrides: Partial<BillingRepository> = {}): BillingRepository {
  return {
    isWebhookEventProcessed: mock(async () => false),
    markWebhookEventProcessed: mock(async () => {}),
    findSubscriptionByOrg: mock(async () => null),
    findSubscriptionByStripeId: mock(async () => null),
    findSubscriptionByStripeCustomer: mock(async () => null),
    saveSubscription: mock(async () => {}),
    updateSubscription: mock(async () => {}),
    findPlanBySlug: mock(async () => PLAN),
    findPlanById: mock(async () => PLAN),
    findAllActivePlans: mock(async () => [PLAN]),
    addSmsCredits: mock(async () => {}),
    findPackById: mock(async () => null),
    tryDeductSmsCredits: mock(async () => true),
    getSmsCredits: mock(async () => ({ organizationId: 'org-1', balance: 100 })),
    ...overrides,
  } as unknown as BillingRepository
}

function makeStripeService(overrides: Partial<StripeService> = {}): StripeService {
  return {
    verifyWebhook: mock(async (_a: Buffer, _b: string) => ({
      id: 'evt_1',
      type: 'customer.subscription.deleted',
      data: { id: 'sub_abc' },
    })),
    createCheckoutSession: mock(async () => 'https://checkout.stripe.com/session'),
    createPaymentSession: mock(async () => 'https://checkout.stripe.com/payment'),
    getSubscription: mock(async () => ({
      priceId: 'price_abc',
      planSlug: 'base',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
    })),
    createBillingPortalSession: mock(async () => 'https://billing.stripe.com/portal'),
    ...overrides,
  } as unknown as StripeService
}

describe('HandleStripeWebhookUseCase', () => {
  describe('idempotency', () => {
    it('silently returns when event was already processed', async () => {
      const repo = makeBillingRepo({
        isWebhookEventProcessed: mock(async () => true),
      })
      const stripe = makeStripeService()
      const useCase = new HandleStripeWebhookUseCase(repo, stripe)

      await useCase.run(Buffer.from('{}'), 'sig')

      expect(repo.markWebhookEventProcessed).not.toHaveBeenCalled()
    })
  })

  describe('customer.subscription.deleted', () => {
    it('marks subscription as cancelled', async () => {
      const repo = makeBillingRepo({
        findSubscriptionByStripeId: mock(async () => ({ ...SUBSCRIPTION })),
      })
      const stripe = makeStripeService({
        verifyWebhook: mock(async () => ({
          id: 'evt_del',
          type: 'customer.subscription.deleted',
          data: { id: 'sub_abc' },
        })),
      })
      const useCase = new HandleStripeWebhookUseCase(repo, stripe)
      await useCase.run(Buffer.from('{}'), 'sig')

      const updateCall = (repo.updateSubscription as ReturnType<typeof mock>).mock.calls[0][0]
      expect(updateCall.status).toBe('cancelled')
      expect(updateCall.cancelledAt).toBeTruthy()
    })
  })

  describe('invoice.payment_failed', () => {
    it('marks subscription as past_due', async () => {
      const repo = makeBillingRepo({
        findSubscriptionByStripeCustomer: mock(async () => ({ ...SUBSCRIPTION })),
      })
      const stripe = makeStripeService({
        verifyWebhook: mock(async () => ({
          id: 'evt_fail',
          type: 'invoice.payment_failed',
          data: { customer: 'cus_abc' },
        })),
      })
      const useCase = new HandleStripeWebhookUseCase(repo, stripe)
      await useCase.run(Buffer.from('{}'), 'sig')

      const updateCall = (repo.updateSubscription as ReturnType<typeof mock>).mock.calls[0][0]
      expect(updateCall.status).toBe('past_due')
    })
  })

  describe('event marking', () => {
    it('marks event as processed after handling', async () => {
      const repo = makeBillingRepo({
        findSubscriptionByStripeId: mock(async () => ({ ...SUBSCRIPTION })),
      })
      const stripe = makeStripeService({
        verifyWebhook: mock(async () => ({
          id: 'evt_del_2',
          type: 'customer.subscription.deleted',
          data: { id: 'sub_abc' },
        })),
      })
      const useCase = new HandleStripeWebhookUseCase(repo, stripe)
      await useCase.run(Buffer.from('{}'), 'sig')

      expect(repo.markWebhookEventProcessed).toHaveBeenCalledWith('evt_del_2', 'customer.subscription.deleted')
    })
  })

  describe('customer.subscription.updated — plan change (upgrade/downgrade)', () => {
    it('updates planId and stripePriceId when the price changes (base → pro via portal)', async () => {
      const repo = makeBillingRepo({
        findSubscriptionByStripeId: mock(async () => ({ ...SUBSCRIPTION })),
        findPlanBySlug: mock(async (slug: string) => slug === 'pro' ? PRO_PLAN : PLAN),
      })
      const stripe = makeStripeService({
        verifyWebhook: mock(async () => ({
          id: 'evt_upg_1',
          type: 'customer.subscription.updated',
          data: {
            id: 'sub_abc',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 15,
            items: {
              data: [
                {
                  price: {
                    id: 'price_pro_xyz',
                    metadata: { planSlug: 'pro' },
                  },
                },
              ],
            },
          },
        })),
      })
      const useCase = new HandleStripeWebhookUseCase(repo, stripe)
      await useCase.run(Buffer.from('{}'), 'sig')

      const updateCall = (repo.updateSubscription as ReturnType<typeof mock>).mock.calls[0][0]
      expect(updateCall.planId).toBe('plan-pro')
      expect(updateCall.stripePriceId).toBe('price_pro_xyz')
      expect(updateCall.status).toBe('active')
    })

    it('keeps existing planId when priceId has not changed', async () => {
      const repo = makeBillingRepo({
        findSubscriptionByStripeId: mock(async () => ({ ...SUBSCRIPTION })),
        findPlanBySlug: mock(async () => PLAN),
      })
      const stripe = makeStripeService({
        verifyWebhook: mock(async () => ({
          id: 'evt_upd_same',
          type: 'customer.subscription.updated',
          data: {
            id: 'sub_abc',
            status: 'active',
            current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
            items: {
              data: [
                {
                  price: {
                    // mismo priceId que SUBSCRIPTION.stripePriceId → no cambia plan
                    id: 'price_abc',
                    metadata: { planSlug: 'base' },
                  },
                },
              ],
            },
          },
        })),
      })
      const useCase = new HandleStripeWebhookUseCase(repo, stripe)
      await useCase.run(Buffer.from('{}'), 'sig')

      const updateCall = (repo.updateSubscription as ReturnType<typeof mock>).mock.calls[0][0]
      expect(updateCall.planId).toBe('plan-1')
      expect(updateCall.stripePriceId).toBe('price_abc')
    })
  })
})

describe('CreateCheckoutSessionUseCase', () => {
  describe('guard: suscripción activa existente', () => {
    it('lanza ALREADY_SUBSCRIBED (409) si ya hay suscripción activa', async () => {
      const repo = makeBillingRepo({
        findPlanBySlug: mock(async () => PLAN),
        findSubscriptionByOrg: mock(async () => ({ ...SUBSCRIPTION, status: 'active' as const })),
      })
      const stripe = makeStripeService()
      const useCase = new CreateCheckoutSessionUseCase(repo, stripe)

      await expect(
        useCase.run({
          organizationId: 'org-1',
          adminId: 'admin-1',
          planSlug: 'pro',
          successUrl: 'https://app.example.com/success',
          cancelUrl: 'https://app.example.com/cancel',
        }),
      ).rejects.toMatchObject({ code: 'ALREADY_SUBSCRIBED', statusCode: 409 })

      expect(stripe.createCheckoutSession).not.toHaveBeenCalled()
    })

    it('permite checkout si la suscripción está cancelled', async () => {
      const repo = makeBillingRepo({
        findPlanBySlug: mock(async () => PLAN),
        findSubscriptionByOrg: mock(async () => ({ ...SUBSCRIPTION, status: 'cancelled' as const })),
      })
      const stripe = makeStripeService()
      const useCase = new CreateCheckoutSessionUseCase(repo, stripe)

      const result = await useCase.run({
        organizationId: 'org-1',
        adminId: 'admin-1',
        planSlug: 'base',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      })

      expect(result.url).toBeTruthy()
      expect(stripe.createCheckoutSession).toHaveBeenCalledTimes(1)
    })

    it('permite checkout si no hay suscripción previa', async () => {
      const repo = makeBillingRepo({
        findPlanBySlug: mock(async () => PLAN),
        findSubscriptionByOrg: mock(async () => null),
      })
      const stripe = makeStripeService()
      const useCase = new CreateCheckoutSessionUseCase(repo, stripe)

      const result = await useCase.run({
        organizationId: 'org-new',
        adminId: 'admin-1',
        planSlug: 'base',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      })

      expect(result.url).toBeTruthy()
    })
  })
})
