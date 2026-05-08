import type { Plan, PlanSlug } from '../entities/Plan.js'
import type { Subscription } from '../entities/Subscription.js'
import type { SmsCreditPack } from '../entities/SmsCreditPack.js'

export interface BillingRepository {
  // Plans
  findPlanBySlug(slug: PlanSlug): Promise<Plan | null>
  findAllActivePlans(): Promise<Plan[]>

  // Subscriptions
  findSubscriptionByOrg(organizationId: string): Promise<Subscription | null>
  findSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null>
  findSubscriptionByStripeCustomer(stripeCustomerId: string): Promise<Subscription | null>
  saveSubscription(subscription: Subscription): Promise<Subscription>
  updateSubscription(subscription: Subscription): Promise<Subscription>

  // SMS Credits
  findSmsCreditsByOrg(organizationId: string): Promise<number>
  addSmsCredits(organizationId: string, amount: number): Promise<void>
  deductSmsCredit(organizationId: string): Promise<boolean>
  deductSmsCredits(organizationId: string, amount: number): Promise<void>

  // SMS Credit Packs
  findAllActivePacks(): Promise<SmsCreditPack[]>
  findPackById(id: string): Promise<SmsCreditPack | null>

  // Webhook idempotency
  isWebhookEventProcessed(stripeEventId: string): Promise<boolean>
  markWebhookEventProcessed(stripeEventId: string, type: string): Promise<void>
}
