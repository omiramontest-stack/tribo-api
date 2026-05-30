import { randomUUID } from 'crypto'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { BillingRepository } from '../../../domain/billing/repository/BillingRepository.js'
import type { Organization } from '../../../domain/organization/entities/Organization.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface CreateOrganizationDto {
  adminId: string
  organizationName: string
  industry?: string
  country?: string
  phone?: string
  logoUrl?: string
}

export class CreateOrganizationUseCase implements UseCase<CreateOrganizationDto, Organization> {
  constructor(
    private readonly _orgRepository: OrganizationRepository,
    private readonly _billingRepository: BillingRepository,
  ) {}

  async run(dto: CreateOrganizationDto): Promise<Organization> {
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
