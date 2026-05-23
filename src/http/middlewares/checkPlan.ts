import type { FastifyRequest, FastifyReply } from 'fastify'
import type { BillingRepository } from '../../domain/billing/repository/BillingRepository.js'
import type { Plan } from '../../domain/billing/entities/Plan.js'

export type PlanFeature = 'emailCampaigns' | 'smsCampaigns' | 'analyticsBasic' | 'analyticsFull'

function planAllows(plan: Plan, feature: PlanFeature): boolean {
  switch (feature) {
    case 'emailCampaigns': return plan.emailCampaigns
    case 'smsCampaigns': return plan.smsCampaigns
    case 'analyticsBasic': return plan.analyticsLevel === 'basic' || plan.analyticsLevel === 'full'
    case 'analyticsFull': return plan.analyticsLevel === 'full'
  }
}

const GRACE_PERIOD_DAYS = 5
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Cache en-proceso con TTL de 60s para el plan activo por organización.
 *  Evita 2 queries a DB en cada endpoint protegido.
 *  El webhook de Stripe invalida la entrada al actualizar la suscripción. */
interface CacheEntry { plan: Plan | null; expiresAt: number }
const planCache = new Map<string, CacheEntry>()
const PLAN_CACHE_TTL_MS = 60_000

function getCachedPlan(orgId: string): Plan | null | undefined {
  const entry = planCache.get(orgId)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) { planCache.delete(orgId); return undefined }
  return entry.plan
}

function setCachedPlan(orgId: string, plan: Plan | null): void {
  planCache.set(orgId, { plan, expiresAt: Date.now() + PLAN_CACHE_TTL_MS })
}

/** Invalida el cache de plan para una organización (llamar desde el webhook de Stripe). */
export function invalidatePlanCache(orgId: string): void {
  planCache.delete(orgId)
}

export function createPlanGuard(billingRepo: BillingRepository) {
  async function getActivePlan(organizationId: string): Promise<Plan | null> {
    const cached = getCachedPlan(organizationId)
    if (cached !== undefined) return cached

    const subscription = await billingRepo.findSubscriptionByOrg(organizationId)
    if (!subscription) { setCachedPlan(organizationId, null); return null }

    const plans = await billingRepo.findAllActivePlans()
    const now = new Date()

    let result: Plan | null = null

    if (subscription.status === 'active') {
      result = plans.find(p => p.id === subscription.planId) ?? null
    } else if (subscription.status === 'trialing') {
      const trialValid = subscription.trialEndsAt != null && new Date(subscription.trialEndsAt) > now
      result = trialValid ? (plans.find(p => p.id === subscription.planId) ?? null) : null
    } else if (subscription.status === 'cancelled' || subscription.status === 'past_due') {
      if (subscription.cancelledAt) {
        const daysSinceCancelled = (now.getTime() - new Date(subscription.cancelledAt).getTime()) / MS_PER_DAY
        if (daysSinceCancelled <= GRACE_PERIOD_DAYS) {
          result = plans.find(p => p.id === subscription.planId) ?? null
        } else {
          result = plans.find(p => p.slug === 'trial') ?? null
        }
      } else {
        // past_due sin cancelledAt: mantener el plan durante la gracia implícita
        result = plans.find(p => p.id === subscription.planId) ?? null
      }
    }

    setCachedPlan(organizationId, result)
    return result
  }

  function requireSubscription() {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const organizationId = request.admin?.organizationId
      if (!organizationId) {
        reply.code(403).send({ error: 'FORBIDDEN', message: 'Organization context required' })
        return
      }
      const plan = await getActivePlan(organizationId)
      if (!plan) {
        reply.code(403).send({ error: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required' })
      }
    }
  }

  function requireFeature(feature: PlanFeature) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const organizationId = request.admin?.organizationId
      if (!organizationId) {
        reply.code(403).send({ error: 'FORBIDDEN', message: 'Organization context required' })
        return
      }
      const plan = await getActivePlan(organizationId)
      if (!plan) {
        reply.code(403).send({ error: 'SUBSCRIPTION_REQUIRED', message: 'An active subscription is required' })
        return
      }
      if (!planAllows(plan, feature)) {
        reply.code(403).send({ error: 'PLAN_UPGRADE_REQUIRED', message: `Your plan does not include this feature` })
      }
    }
  }

  async function checkWalletLimit(organizationId: string, currentCount: number): Promise<{ allowed: boolean; max: number }> {
    const plan = await getActivePlan(organizationId)
    if (!plan) return { allowed: false, max: 0 }
    return { allowed: currentCount < plan.maxWallets, max: plan.maxWallets }
  }

  async function checkPassLimit(organizationId: string, currentCount: number): Promise<{ allowed: boolean; max: number | null }> {
    const plan = await getActivePlan(organizationId)
    if (!plan) return { allowed: false, max: null }
    if (plan.maxPasses === null) return { allowed: true, max: null }
    return { allowed: currentCount < plan.maxPasses, max: plan.maxPasses }
  }

  async function checkFeatureAllowed(organizationId: string, feature: PlanFeature): Promise<boolean> {
    const plan = await getActivePlan(organizationId)
    if (!plan) return false
    return planAllows(plan, feature)
  }

  return { requireSubscription, requireFeature, checkWalletLimit, checkPassLimit, checkFeatureAllowed }
}

export type PlanGuard = ReturnType<typeof createPlanGuard>
