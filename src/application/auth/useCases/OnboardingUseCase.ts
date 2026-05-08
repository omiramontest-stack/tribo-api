import { randomUUID } from 'crypto'
import type { PrismaClient } from '@prisma/client'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Organization } from '../../../domain/organization/entities/Organization.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'
import type { CreateTrialUseCase } from '../../billing/useCases/CreateTrialUseCase.js'

export interface OnboardingDto {
  adminId: string
  organizationName: string
  industry?: string
  country?: string
  phone?: string
  logoUrl?: string
}

export class OnboardingUseCase implements UseCase<OnboardingDto, Organization> {
  constructor(
    private readonly _orgRepository: OrganizationRepository,
    private readonly _createTrial: CreateTrialUseCase,
    private readonly _db: PrismaClient,
  ) {}

  async run(dto: OnboardingDto): Promise<Organization> {
    const existing = await this._orgRepository.findByAdminId(dto.adminId)
    if (existing.length > 0) throw new AppError('ALREADY_ONBOARDED', 'Already has an organization', 409)

    const orgId = randomUUID()
    const memberId = randomUUID()
    const now = new Date()

    const org = await this._db.$transaction(async (tx) => {
      const orgRow = await tx.organization.create({
        data: {
          id: orgId,
          name: dto.organizationName,
          logoUrl: dto.logoUrl ?? null,
          industry: dto.industry ?? null,
          country: dto.country ?? null,
          phone: dto.phone ?? null,
        },
      })

      await tx.organizationMember.create({
        data: {
          id: memberId,
          organizationId: orgId,
          adminId: dto.adminId,
          role: 'owner',
        },
      })

      const trialPlan = await tx.plan.findUnique({ where: { slug: 'trial' } })
      if (!trialPlan) throw new AppError('PLAN_NOT_FOUND', 'Trial plan not configured', 500)

      const trialEndsAt = new Date(now.getTime() + 14 * 86400000)

      await tx.subscription.create({
        data: {
          id: randomUUID(),
          organizationId: orgId,
          planId: trialPlan.id,
          status: 'trialing',
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripePriceId: null,
          cancelledAt: null,
        },
      })

      return {
        id: orgRow.id,
        name: orgRow.name,
        logoUrl: orgRow.logoUrl,
        industry: orgRow.industry,
        country: orgRow.country,
        phone: orgRow.phone,
        createdAt: orgRow.createdAt.toISOString(),
      } satisfies Organization
    })

    return org
  }
}
