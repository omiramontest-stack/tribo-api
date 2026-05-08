import type { BillingRepository } from '../../../domain/billing/repository/BillingRepository.js'
import type { StripeService } from '../../../infrastructure/billing/stripe/StripeService.js'
import type { PlanSlug } from '../../../domain/billing/entities/Plan.js'
import { AppError } from '../../common/AppError.js'

export interface CreateCheckoutDto {
  organizationId: string
  adminId: string
  planSlug: PlanSlug
  successUrl: string
  cancelUrl: string
}

export class CreateCheckoutSessionUseCase {
  constructor(
    private readonly _billingRepo: BillingRepository,
    private readonly _stripeService: StripeService,
  ) {}

  async run(dto: CreateCheckoutDto): Promise<{ url: string }> {
    const plan = await this._billingRepo.findPlanBySlug(dto.planSlug)
    if (!plan || !plan.isActive) throw new AppError('PLAN_NOT_FOUND', 'Plan not found', 404)
    if (!plan.stripePriceId) throw new AppError('PLAN_NOT_CONFIGURED', 'Plan has no Stripe price', 500)

    const subscription = await this._billingRepo.findSubscriptionByOrg(dto.organizationId)
    const stripeCustomerId = subscription?.stripeCustomerId ?? undefined

    const url = await this._stripeService.createCheckoutSession({
      priceId: plan.stripePriceId,
      customerId: stripeCustomerId,
      organizationId: dto.organizationId,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    })

    return { url }
  }
}
