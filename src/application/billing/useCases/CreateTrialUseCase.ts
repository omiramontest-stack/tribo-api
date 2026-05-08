import { randomUUID } from 'crypto'
import type { BillingRepository } from '../../../domain/billing/repository/BillingRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Subscription } from '../../../domain/billing/entities/Subscription.js'
import { AppError } from '../../common/AppError.js'

const TRIAL_DAYS = 14

export class CreateTrialUseCase {
  constructor(
    private readonly _billingRepo: BillingRepository,
    private readonly _orgRepo: OrganizationRepository,
  ) {}

  async run(organizationId: string): Promise<Subscription> {
    const existing = await this._billingRepo.findSubscriptionByOrg(organizationId)
    if (existing) throw new AppError('SUBSCRIPTION_EXISTS', 'Organization already has a subscription', 409)

    const trialPlan = await this._billingRepo.findPlanBySlug('trial')
    if (!trialPlan) throw new AppError('PLAN_NOT_FOUND', 'Trial plan not configured', 500)

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000)

    const subscription: Subscription = {
      id: randomUUID(),
      organizationId,
      planId: trialPlan.id,
      status: 'trialing',
      trialEndsAt: trialEndsAt.toISOString(),
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: trialEndsAt.toISOString(),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      cancelledAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return this._billingRepo.saveSubscription(subscription)
  }
}
