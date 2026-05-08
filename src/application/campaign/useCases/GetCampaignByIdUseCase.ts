import type { CampaignRepository } from '../../../domain/campaign/repository/CampaignRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Campaign } from '../../../domain/campaign/entities/Campaign.js'
import { AppError } from '../../common/AppError.js'

export interface GetCampaignByIdDto {
  campaignId: string
  organizationId: string
  adminId: string
}

export class GetCampaignByIdUseCase {
  constructor(
    private readonly _campaignRepository: CampaignRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: GetCampaignByIdDto): Promise<Campaign> {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const campaign = await this._campaignRepository.findById(dto.campaignId)
    if (!campaign || campaign.organizationId !== dto.organizationId)
      throw new AppError('CAMPAIGN_NOT_FOUND', 'Campaign not found', 404)

    return campaign
  }
}
