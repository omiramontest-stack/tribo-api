import { randomUUID } from 'crypto'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { BillingRepository } from '../../../domain/billing/repository/BillingRepository.js'
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
    private readonly _billingRepository: BillingRepository,
    private readonly _createTrial: CreateTrialUseCase,
  ) {}

  async run(dto: OnboardingDto): Promise<Organization> {
    const existing = await this._orgRepository.findByAdminId(dto.adminId)

    if (existing.length > 0) {
      const org = existing[0]
      const subscription = await this._billingRepository.findSubscriptionByOrg(org.id)
      if (subscription) throw new AppError('ALREADY_ONBOARDED', 'Already has an organization', 409)

      // org exists but no subscription (orphaned) — create trial
      await this._createTrial.run(org.id)
      return org
    }

    const trialPlan = await this._billingRepository.findPlanBySlug('trial')
    if (!trialPlan) throw new AppError('PLAN_NOT_FOUND', 'Trial plan not configured', 500)

    const now = new Date()
    const trialEndsAt = new Date(now.getTime() + 14 * 86400000)

    return this._orgRepository.createWithMemberAndSubscription({
      orgId: randomUUID(),
      name: dto.organizationName,
      logoUrl: dto.logoUrl ?? null,
      industry: dto.industry ?? null,
      country: dto.country ?? null,
      phone: dto.phone ?? null,
      memberId: randomUUID(),
      adminId: dto.adminId,
      subscriptionId: randomUUID(),
      planId: trialPlan.id,
      trialEndsAt,
      now,
    })
  }
}
