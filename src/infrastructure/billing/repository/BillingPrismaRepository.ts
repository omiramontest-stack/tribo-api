import type { PrismaClient } from '@prisma/client'
import type { BillingRepository } from '../../../domain/billing/repository/BillingRepository.js'
import type { Plan, PlanSlug, AnalyticsLevel } from '../../../domain/billing/entities/Plan.js'
import type { Subscription } from '../../../domain/billing/entities/Subscription.js'
import type { SmsCreditPack } from '../../../domain/billing/entities/SmsCreditPack.js'

function toPlan(r: Awaited<ReturnType<PrismaClient['plan']['findUniqueOrThrow']>>): Plan {
  return {
    id: r.id,
    slug: r.slug as PlanSlug,
    name: r.name,
    price: r.price,
    currency: r.currency,
    stripePriceId: r.stripePriceId,
    maxWallets: r.maxWallets,
    maxPasses: r.maxPasses,
    emailCampaigns: r.emailCampaigns,
    smsCampaigns: r.smsCampaigns,
    analyticsLevel: r.analyticsLevel as AnalyticsLevel,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

function toSub(r: Awaited<ReturnType<PrismaClient['subscription']['findUniqueOrThrow']>>): Subscription {
  return {
    id: r.id,
    organizationId: r.organizationId,
    planId: r.planId,
    status: r.status as Subscription['status'],
    trialEndsAt: r.trialEndsAt?.toISOString() ?? null,
    currentPeriodStart: r.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: r.currentPeriodEnd?.toISOString() ?? null,
    stripeCustomerId: r.stripeCustomerId,
    stripeSubscriptionId: r.stripeSubscriptionId,
    stripePriceId: r.stripePriceId,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

function toPack(r: Awaited<ReturnType<PrismaClient['smsCreditPack']['findUniqueOrThrow']>>): SmsCreditPack {
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    currency: r.currency,
    credits: r.credits,
    stripePriceId: r.stripePriceId,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export class BillingPrismaRepository implements BillingRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findPlanBySlug(slug: PlanSlug): Promise<Plan | null> {
    const r = await this._db.plan.findUnique({ where: { slug } })
    return r ? toPlan(r) : null
  }

  async findAllActivePlans(): Promise<Plan[]> {
    const rows = await this._db.plan.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } })
    return rows.map(toPlan)
  }

  async findSubscriptionByOrg(organizationId: string): Promise<Subscription | null> {
    const r = await this._db.subscription.findUnique({ where: { organizationId } })
    return r ? toSub(r) : null
  }

  async findSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const r = await this._db.subscription.findUnique({ where: { stripeSubscriptionId } })
    return r ? toSub(r) : null
  }

  async findSubscriptionByStripeCustomer(stripeCustomerId: string): Promise<Subscription | null> {
    const r = await this._db.subscription.findUnique({ where: { stripeCustomerId } })
    return r ? toSub(r) : null
  }

  async saveSubscription(sub: Subscription): Promise<Subscription> {
    const r = await this._db.subscription.create({
      data: {
        id: sub.id,
        organizationId: sub.organizationId,
        planId: sub.planId,
        status: sub.status,
        trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt) : null,
        currentPeriodStart: sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : null,
        currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
        stripeCustomerId: sub.stripeCustomerId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        stripePriceId: sub.stripePriceId,
        cancelledAt: sub.cancelledAt ? new Date(sub.cancelledAt) : null,
      },
    })
    return toSub(r)
  }

  async updateSubscription(sub: Subscription): Promise<Subscription> {
    const r = await this._db.subscription.update({
      where: { id: sub.id },
      data: {
        planId: sub.planId,
        status: sub.status,
        trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt) : null,
        currentPeriodStart: sub.currentPeriodStart ? new Date(sub.currentPeriodStart) : null,
        currentPeriodEnd: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
        stripeCustomerId: sub.stripeCustomerId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        stripePriceId: sub.stripePriceId,
        cancelledAt: sub.cancelledAt ? new Date(sub.cancelledAt) : null,
      },
    })
    return toSub(r)
  }

  async findSmsCreditsByOrg(organizationId: string): Promise<number> {
    const r = await this._db.smsCredit.findUnique({ where: { organizationId } })
    return r?.balance ?? 0
  }

  async addSmsCredits(organizationId: string, amount: number): Promise<void> {
    await this._db.smsCredit.upsert({
      where: { organizationId },
      update: { balance: { increment: amount } },
      create: { organizationId, balance: amount },
    })
  }

  async deductSmsCredit(organizationId: string): Promise<boolean> {
    const credit = await this._db.smsCredit.findUnique({ where: { organizationId } })
    if (!credit || credit.balance <= 0) return false
    await this._db.smsCredit.update({
      where: { organizationId },
      data: { balance: { decrement: 1 } },
    })
    return true
  }

  async deductSmsCredits(organizationId: string, amount: number): Promise<void> {
    await this._db.smsCredit.update({
      where: { organizationId },
      data: { balance: { decrement: amount } },
    })
  }

  async findAllActivePacks(): Promise<SmsCreditPack[]> {
    const rows = await this._db.smsCreditPack.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } })
    return rows.map(toPack)
  }

  async findPackById(id: string): Promise<SmsCreditPack | null> {
    const r = await this._db.smsCreditPack.findUnique({ where: { id } })
    return r ? toPack(r) : null
  }

  async isWebhookEventProcessed(stripeEventId: string): Promise<boolean> {
    const r = await this._db.stripeWebhookEvent.findUnique({ where: { id: stripeEventId } })
    return !!r
  }

  async markWebhookEventProcessed(stripeEventId: string, type: string): Promise<void> {
    await this._db.stripeWebhookEvent.create({ data: { id: stripeEventId, type } })
  }
}
