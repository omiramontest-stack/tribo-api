import type { CampaignRepository } from '../../../domain/campaign/repository/CampaignRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Campaign } from '../../../domain/campaign/entities/Campaign.js'
import type { PaginationParams, PaginatedResult } from '../../common/Pagination.js'
import { AppError } from '../../common/AppError.js'

export interface GetCampaignsDto {
  organizationId: string
  adminId: string
  status?: Campaign['status']
  pagination: PaginationParams
}

export class GetCampaignsUseCase {
  constructor(
    private readonly _campaignRepository: CampaignRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: GetCampaignsDto): Promise<PaginatedResult<Campaign>> {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    return this._campaignRepository.findByOrg(dto.organizationId, dto.pagination, dto.status)
  }
}
