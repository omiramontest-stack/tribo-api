import Stripe from 'stripe'

export interface StripeWebhookPayload {
  id: string
  type: string
  data: Record<string, unknown>
}

export interface StripeSubscriptionData {
  priceId: string
  planSlug: string
  currentPeriodStart: string
  currentPeriodEnd: string
}

export interface CheckoutParams {
  priceId: string
  customerId?: string
  organizationId: string
  successUrl: string
  cancelUrl: string
}

export interface PaymentParams extends CheckoutParams {
  packId: string
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia' as any })
}

export class StripeService {
  async createCheckoutSession(params: CheckoutParams): Promise<string> {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: params.priceId, quantity: 1 }],
      customer: params.customerId,
      metadata: { organizationId: params.organizationId },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: true,
    })
    return session.url!
  }

  async createPaymentSession(params: PaymentParams): Promise<string> {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: params.priceId, quantity: 1 }],
      customer: params.customerId,
      metadata: { organizationId: params.organizationId, packId: params.packId },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      allow_promotion_codes: true,
    })
    return session.url!
  }

  async getSubscription(stripeSubscriptionId: string): Promise<StripeSubscriptionData> {
    const stripe = getStripe()
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId)
    const raw = sub as unknown as Record<string, unknown>
    const item = sub.items.data[0]
    const itemRaw = item as unknown as Record<string, unknown>

    const periodStart = (raw['current_period_start'] ?? itemRaw['current_period_start']) as number | undefined
    const periodEnd = (raw['current_period_end'] ?? itemRaw['current_period_end']) as number | undefined

    return {
      priceId: item.price.id,
      planSlug: (item.price.metadata['planSlug'] as string) ?? 'base',
      currentPeriodStart: periodStart ? new Date(periodStart * 1000).toISOString() : new Date().toISOString(),
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
    }
  }

  async verifyWebhook(rawBody: Buffer, signature: string): Promise<StripeWebhookPayload> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured')
    const stripe = getStripe()
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret)
    return {
      id: event.id,
      type: event.type,
      data: event.data.object as unknown as Record<string, unknown>,
    }
  }

  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return session.url
  }
}
