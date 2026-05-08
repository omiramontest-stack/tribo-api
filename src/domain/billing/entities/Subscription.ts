export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled'

export interface Subscription {
  id: string
  organizationId: string
  planId: string
  status: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripePriceId: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}
