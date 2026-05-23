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
  /**
   * Deduce `amount` créditos de forma atómica usando UPDATE con condición.
   * Devuelve `true` si había suficientes créditos y se dedujeron,
   * `false` si el balance era insuficiente (sin modificar el saldo).
   * Previene race conditions de saldo negativo bajo concurrencia.
   */
  tryDeductSmsCredits(organizationId: string, amount: number): Promise<boolean>

  // SMS Credit Packs
  findAllActivePacks(): Promise<SmsCreditPack[]>
  findPackById(id: string): Promise<SmsCreditPack | null>

  // Webhook idempotency
  isWebhookEventProcessed(stripeEventId: string): Promise<boolean>
  markWebhookEventProcessed(stripeEventId: string, type: string): Promise<void>
}
