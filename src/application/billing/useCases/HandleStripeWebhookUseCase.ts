import type { BillingRepository } from '../../../domain/billing/repository/BillingRepository.js'
import type { StripeService, StripeWebhookPayload } from '../../../infrastructure/billing/stripe/StripeService.js'
import type { PlanSlug } from '../../../domain/billing/entities/Plan.js'

export class HandleStripeWebhookUseCase {
  constructor(
    private readonly _billingRepo: BillingRepository,
    private readonly _stripeService: StripeService,
  ) {}

  async run(rawBody: Buffer, signature: string): Promise<void> {
    const event = await this._stripeService.verifyWebhook(rawBody, signature)

    const already = await this._billingRepo.isWebhookEventProcessed(event.id)
    if (already) return

    await this._handleEvent(event)
    await this._billingRepo.markWebhookEventProcessed(event.id, event.type)
  }

  private async _handleEvent(event: StripeWebhookPayload): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this._handleCheckoutCompleted(event.data)
        break
      case 'customer.subscription.updated':
        await this._handleSubscriptionUpdated(event.data)
        break
      case 'customer.subscription.deleted':
        await this._handleSubscriptionDeleted(event.data)
        break
      case 'invoice.paid':
        await this._handleInvoicePaid(event.data)
        break
      case 'invoice.payment_failed':
        await this._handlePaymentFailed(event.data)
        break
    }
  }

  private async _handleCheckoutCompleted(data: Record<string, unknown>): Promise<void> {
    const mode = data['mode'] as string
    const organizationId = (data['metadata'] as Record<string, string>)['organizationId']
    const customerId = data['customer'] as string

    if (mode === 'subscription') {
      const stripeSubscriptionId = data['subscription'] as string
      const subData = await this._stripeService.getSubscription(stripeSubscriptionId)
      const priceId = subData.priceId
      const planSlug = subData.planSlug as PlanSlug

      const plan = await this._billingRepo.findPlanBySlug(planSlug)
      if (!plan) return

      const existing = await this._billingRepo.findSubscriptionByOrg(organizationId)

      const updated = {
        ...(existing ?? {
          id: crypto.randomUUID(),
          organizationId,
          cancelledAt: null,
          createdAt: new Date().toISOString(),
        }),
        planId: plan.id,
        status: 'active' as const,
        stripeCustomerId: customerId,
        stripeSubscriptionId,
        stripePriceId: priceId,
        trialEndsAt: null,
        currentPeriodStart: subData.currentPeriodStart,
        currentPeriodEnd: subData.currentPeriodEnd,
        updatedAt: new Date().toISOString(),
      }

      existing
        ? await this._billingRepo.updateSubscription(updated as never)
        : await this._billingRepo.saveSubscription(updated as never)
    }

    if (mode === 'payment') {
      const packId = (data['metadata'] as Record<string, string>)['packId']
      if (!packId) return
      const pack = await this._billingRepo.findPackById(packId)
      if (!pack) return
      await this._billingRepo.addSmsCredits(organizationId, pack.credits)
    }
  }

  private async _handleSubscriptionUpdated(data: Record<string, unknown>): Promise<void> {
    const stripeSubscriptionId = data['id'] as string
    const subscription = await this._billingRepo.findSubscriptionByStripeId(stripeSubscriptionId)
    if (!subscription) return

    const status = this._mapStripeStatus(data['status'] as string)
    const currentPeriodEnd = new Date((data['current_period_end'] as number) * 1000).toISOString()

    await this._billingRepo.updateSubscription({
      ...subscription,
      status,
      currentPeriodEnd,
      cancelledAt: status === 'active' ? null : subscription.cancelledAt,
      updatedAt: new Date().toISOString(),
    })
  }

  private async _handleInvoicePaid(data: Record<string, unknown>): Promise<void> {
    const stripeSubscriptionId = data['subscription'] as string | undefined
    if (!stripeSubscriptionId) return

    const subscription = await this._billingRepo.findSubscriptionByStripeId(stripeSubscriptionId)
    if (!subscription) return

    await this._billingRepo.updateSubscription({
      ...subscription,
      status: 'active',
      cancelledAt: null,
      updatedAt: new Date().toISOString(),
    })
  }

  private async _handleSubscriptionDeleted(data: Record<string, unknown>): Promise<void> {
    const stripeSubscriptionId = data['id'] as string
    const subscription = await this._billingRepo.findSubscriptionByStripeId(stripeSubscriptionId)
    if (!subscription) return

    await this._billingRepo.updateSubscription({
      ...subscription,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  private async _handlePaymentFailed(data: Record<string, unknown>): Promise<void> {
    const customerId = data['customer'] as string
    const subscription = await this._billingRepo.findSubscriptionByStripeCustomer(customerId)
    if (!subscription) return

    await this._billingRepo.updateSubscription({
      ...subscription,
      status: 'past_due',
      updatedAt: new Date().toISOString(),
    })
  }

  private _mapStripeStatus(status: string): 'active' | 'past_due' | 'cancelled' | 'trialing' {
    const map: Record<string, 'active' | 'past_due' | 'cancelled' | 'trialing'> = {
      active: 'active',
      trialing: 'trialing',
      past_due: 'past_due',
      canceled: 'cancelled',
      unpaid: 'past_due',
    }
    return map[status] ?? 'past_due'
  }
}
