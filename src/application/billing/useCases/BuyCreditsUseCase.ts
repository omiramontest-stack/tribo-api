import type { BillingRepository } from '../../../domain/billing/repository/BillingRepository.js'
import type { StripeService } from '../../../infrastructure/billing/stripe/StripeService.js'
import { AppError } from '../../common/AppError.js'

export interface BuyCreditsDto {
  organizationId: string
  packId: string
  successUrl: string
  cancelUrl: string
}

export class BuyCreditsUseCase {
  constructor(
    private readonly _billingRepo: BillingRepository,
    private readonly _stripeService: StripeService,
  ) {}

  async run(dto: BuyCreditsDto): Promise<{ url: string }> {
    const pack = await this._billingRepo.findPackById(dto.packId)
    if (!pack || !pack.isActive) throw new AppError('PACK_NOT_FOUND', 'Credit pack not found', 404)
    if (!pack.stripePriceId) throw new AppError('PACK_NOT_CONFIGURED', 'Pack has no Stripe price', 500)

    const subscription = await this._billingRepo.findSubscriptionByOrg(dto.organizationId)
    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) {
      throw new AppError('NO_ACTIVE_SUBSCRIPTION', 'Active subscription required to buy credits', 403)
    }

    const url = await this._stripeService.createPaymentSession({
      priceId: pack.stripePriceId,
      customerId: subscription.stripeCustomerId ?? undefined,
      organizationId: dto.organizationId,
      packId: dto.packId,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    })

    return { url }
  }
}
