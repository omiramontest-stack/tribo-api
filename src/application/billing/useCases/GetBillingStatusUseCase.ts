import type { BillingRepository } from '../../../domain/billing/repository/BillingRepository.js'
import type { Plan } from '../../../domain/billing/entities/Plan.js'
import type { Subscription } from '../../../domain/billing/entities/Subscription.js'

const GRACE_PERIOD_DAYS = 5
const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface GracePeriod {
  daysRemaining: number
  expiresAt: string
}

export interface TrialInfo {
  daysRemaining: number
  endsAt: string
}

export interface BillingStatus {
  subscription: Subscription | null
  plan: Plan | null
  smsCredits: number
  isActive: boolean
  gracePeriod: GracePeriod | null
  trialInfo: TrialInfo | null
}

export class GetBillingStatusUseCase {
  constructor(private readonly _billingRepo: BillingRepository) {}

  async run(organizationId: string): Promise<BillingStatus> {
    const subscription = await this._billingRepo.findSubscriptionByOrg(organizationId)

    if (!subscription) {
      return { subscription: null, plan: null, smsCredits: 0, isActive: false, gracePeriod: null, trialInfo: null }
    }

    const allPlans = await this._billingRepo.findAllActivePlans()
    const plan = allPlans.find(p => p.id === subscription.planId) ?? null
    const smsCredits = await this._billingRepo.findSmsCreditsByOrg(organizationId)
    const isActive = subscription.status === 'active'

    let trialInfo: TrialInfo | null = null
    if (subscription.status === 'trialing' && subscription.trialEndsAt) {
      const endsAt = new Date(subscription.trialEndsAt)
      const daysRemaining = Math.ceil((endsAt.getTime() - Date.now()) / MS_PER_DAY)
      if (daysRemaining > 0) {
        trialInfo = { daysRemaining, endsAt: endsAt.toISOString() }
      }
    }

    let gracePeriod: GracePeriod | null = null
    if (
      (subscription.status === 'cancelled' || subscription.status === 'past_due') &&
      subscription.cancelledAt
    ) {
      const cancelledAt = new Date(subscription.cancelledAt)
      const expiresAt = new Date(cancelledAt.getTime() + GRACE_PERIOD_DAYS * MS_PER_DAY)
      const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / MS_PER_DAY)
      if (daysRemaining > 0) {
        gracePeriod = { daysRemaining, expiresAt: expiresAt.toISOString() }
      }
    }

    return { subscription, plan, smsCredits, isActive, gracePeriod, trialInfo }
  }
}
