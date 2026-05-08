import { randomUUID } from 'crypto'
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
  ) {}

  async run(dto: OnboardingDto): Promise<Organization> {
    const existing = await this._orgRepository.findByAdminId(dto.adminId)
    if (existing.length > 0) throw new AppError('ALREADY_ONBOARDED', 'Already has an organization', 409)

    const org = await this._orgRepository.save({
      id: randomUUID(),
      name: dto.organizationName,
      logoUrl: dto.logoUrl ?? null,
      industry: dto.industry ?? null,
      country: dto.country ?? null,
      phone: dto.phone ?? null,
      createdAt: new Date().toISOString(),
    })

    await this._orgRepository.addMember({
      id: randomUUID(),
      organizationId: org.id,
      adminId: dto.adminId,
      role: 'owner',
      createdAt: new Date().toISOString(),
    })

    await this._createTrial.run(org.id)

    return org
  }
}
