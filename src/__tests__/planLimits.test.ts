/**
 * Tests — Plan limits / checkPlan middleware (Fix-22 / Flow 4)
 *
 * Tests the critical invariants of getActivePlan() logic inside createPlanGuard:
 *   - Active subscription → returns the plan
 *   - Trialing subscription with valid trial → returns plan
 *   - Trialing subscription with expired trial → returns null
 *   - Cancelled subscription within grace period → returns plan
 *   - Cancelled subscription past grace period → returns trial plan
 *   - past_due without cancelledAt → returns plan (grace period applies)
 *   - No subscription → returns null
 *   - Cache: second call within TTL doesn't hit the DB
 *   - planAllows() correctly gates features
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import type { BillingRepository } from '../domain/billing/repository/BillingRepository.js'
import type { Plan } from '../domain/billing/entities/Plan.js'
import type { Subscription } from '../domain/billing/entities/Subscription.js'
import { createPlanGuard, invalidatePlanCache } from '../http/middlewares/checkPlan.js'

const BASE_PLAN: Plan = {
  id: 'plan-base',
  slug: 'base',
  name: 'Base',
  price: 49,
  currency: 'USD',
  stripePriceId: 'price_base',
  maxWallets: 10,
  maxPasses: 5000,
  emailCampaigns: true,
  smsCampaigns: true,
  analyticsLevel: 'basic',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const TRIAL_PLAN: Plan = {
  ...BASE_PLAN,
  id: 'plan-trial',
  slug: 'trial',
  name: 'Trial',
  stripePriceId: null,
  maxWallets: 1,
  maxPasses: 100,
  emailCampaigns: false,
  smsCampaigns: false,
}

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    organizationId: 'org-1',
    planId: 'plan-base',
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
    ...overrides,
  }
}

function makeRepo(overrides: Partial<BillingRepository> = {}): BillingRepository {
  return {
    findSubscriptionByOrg: mock(async () => null),
    findAllActivePlans: mock(async () => [BASE_PLAN, TRIAL_PLAN]),
    ...overrides,
  } as unknown as BillingRepository
}

// Helper: call getActivePlan via the checkWalletLimit helper (which internally calls getActivePlan)
async function getActivePlan(repo: BillingRepository, orgId: string): Promise<Plan | null> {
  // Use checkWalletLimit with count=0 to probe active plan without rejecting
  const guard = createPlanGuard(repo)
  const { allowed, max } = await guard.checkWalletLimit(orgId, 0)
  if (!allowed && max === 0) return null
  // get the plan directly via checkFeatureAllowed
  const features: Array<'emailCampaigns' | 'smsCampaigns' | 'analyticsBasic' | 'analyticsFull'> =
    ['emailCampaigns', 'smsCampaigns', 'analyticsBasic', 'analyticsFull']
  for (const f of features) {
    await guard.checkFeatureAllowed(orgId, f)
  }
  return null
}

describe('Plan guard — getActivePlan logic', () => {
  beforeEach(() => {
    // Clear the cache so each test starts fresh
    invalidatePlanCache('org-1')
    invalidatePlanCache('org-2')
    invalidatePlanCache('org-cache')
  })

  it('returns plan for active subscription', async () => {
    const repo = makeRepo({
      findSubscriptionByOrg: mock(async () => makeSub({ status: 'active' })),
    })
    const guard = createPlanGuard(repo)
    const { allowed } = await guard.checkWalletLimit('org-1', 0)
    expect(allowed).toBe(true)
  })

  it('returns plan for trialing subscription with valid trial end date', async () => {
    const repo = makeRepo({
      findSubscriptionByOrg: mock(async () => makeSub({
        status: 'trialing',
        trialEndsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      })),
    })
    const guard = createPlanGuard(repo)
    const { allowed } = await guard.checkWalletLimit('org-1', 0)
    expect(allowed).toBe(true)
  })

  it('returns null for trialing subscription with expired trial', async () => {
    const repo = makeRepo({
      findSubscriptionByOrg: mock(async () => makeSub({
        status: 'trialing',
        trialEndsAt: new Date(Date.now() - 1000).toISOString(),
      })),
    })
    const guard = createPlanGuard(repo)
    const { allowed, max } = await guard.checkWalletLimit('org-1', 0)
    expect(allowed).toBe(false)
    expect(max).toBe(0)
  })

  it('returns plan for cancelled subscription within 5-day grace period', async () => {
    const repo = makeRepo({
      findSubscriptionByOrg: mock(async () => makeSub({
        status: 'cancelled',
        cancelledAt: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
      })),
    })
    const guard = createPlanGuard(repo)
    const { allowed } = await guard.checkWalletLimit('org-1', 0)
    expect(allowed).toBe(true)
  })

  it('returns trial plan for cancelled subscription past 5-day grace period', async () => {
    const repo = makeRepo({
      findSubscriptionByOrg: mock(async () => makeSub({
        status: 'cancelled',
        cancelledAt: new Date(Date.now() - 10 * 86400000).toISOString(), // 10 days ago
      })),
    })
    const guard = createPlanGuard(repo)
    // Trial plan has maxWallets=1, so limit check with count=0 should be allowed
    const { allowed, max } = await guard.checkWalletLimit('org-1', 0)
    expect(allowed).toBe(true)
    expect(max).toBe(1) // trial plan limit
  })

  it('returns plan for past_due without cancelledAt (implicit grace period)', async () => {
    const repo = makeRepo({
      findSubscriptionByOrg: mock(async () => makeSub({
        status: 'past_due',
        cancelledAt: null,
      })),
    })
    const guard = createPlanGuard(repo)
    const { allowed } = await guard.checkWalletLimit('org-1', 0)
    expect(allowed).toBe(true)
  })

  it('returns null (no plan) when there is no subscription', async () => {
    const repo = makeRepo({
      findSubscriptionByOrg: mock(async () => null),
    })
    const guard = createPlanGuard(repo)
    const { allowed, max } = await guard.checkWalletLimit('org-1', 0)
    expect(allowed).toBe(false)
    expect(max).toBe(0)
  })

  it('does not hit the DB on second call within TTL (cache hit)', async () => {
    const findSub = mock(async () => makeSub({ status: 'active' }))
    const repo = makeRepo({ findSubscriptionByOrg: findSub })
    const guard = createPlanGuard(repo)

    await guard.checkWalletLimit('org-cache', 0)
    await guard.checkWalletLimit('org-cache', 1)

    // findSubscriptionByOrg should only be called once (cache on second call)
    expect(findSub).toHaveBeenCalledTimes(1)
  })

  it('cache is invalidated after invalidatePlanCache()', async () => {
    const findSub = mock(async () => makeSub({ status: 'active' }))
    const repo = makeRepo({ findSubscriptionByOrg: findSub })
    const guard = createPlanGuard(repo)

    await guard.checkWalletLimit('org-cache', 0)
    invalidatePlanCache('org-cache')
    await guard.checkWalletLimit('org-cache', 0)

    expect(findSub).toHaveBeenCalledTimes(2)
  })
})

describe('Plan guard — feature gating', () => {
  beforeEach(() => invalidatePlanCache('org-feat'))

  it('allows emailCampaigns when plan has it enabled', async () => {
    const repo = makeRepo({
      findSubscriptionByOrg: mock(async () => makeSub({ status: 'active' })),
    })
    const guard = createPlanGuard(repo)
    const allowed = await guard.checkFeatureAllowed('org-feat', 'emailCampaigns')
    expect(allowed).toBe(true)
  })

  it('denies smsCampaigns when plan has it disabled', async () => {
    const noSmsRepo = makeRepo({
      findSubscriptionByOrg: mock(async () => makeSub({ status: 'active', planId: 'plan-trial' })),
      findAllActivePlans: mock(async () => [{ ...TRIAL_PLAN, smsCampaigns: false }]),
    })
    const guard = createPlanGuard(noSmsRepo)
    const allowed = await guard.checkFeatureAllowed('org-feat', 'smsCampaigns')
    expect(allowed).toBe(false)
  })
})
