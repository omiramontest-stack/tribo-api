import type { CampaignRepository } from '../../../domain/campaign/repository/CampaignRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { CampaignStats } from '../../../domain/campaign/entities/CampaignStats.js'
import { AppError } from '../../common/AppError.js'

export interface GetCampaignStatsDto {
  campaignId: string
  organizationId: string
  adminId: string
  windowDays?: number
}

export class GetCampaignStatsUseCase {
  constructor(
    private readonly _campaignRepository: CampaignRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: GetCampaignStatsDto): Promise<CampaignStats> {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const campaign = await this._campaignRepository.findById(dto.campaignId)
    if (!campaign || campaign.organizationId !== dto.organizationId)
      throw new AppError('CAMPAIGN_NOT_FOUND', 'Campaign not found', 404)

    return this._campaignRepository.getCampaignStats(dto.campaignId, dto.windowDays)
  }
}
