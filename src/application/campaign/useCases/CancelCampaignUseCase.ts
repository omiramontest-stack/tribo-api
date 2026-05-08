import type { CampaignRepository } from '../../../domain/campaign/repository/CampaignRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import { AppError } from '../../common/AppError.js'

export interface CancelCampaignDto {
  campaignId: string
  organizationId: string
  adminId: string
}

export class CancelCampaignUseCase {
  constructor(
    private readonly _campaignRepository: CampaignRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: CancelCampaignDto): Promise<void> {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const campaign = await this._campaignRepository.findById(dto.campaignId)
    if (!campaign || campaign.organizationId !== dto.organizationId)
      throw new AppError('CAMPAIGN_NOT_FOUND', 'Campaign not found', 404)

    if (campaign.status === 'sent' || campaign.status === 'cancelled')
      throw new AppError('INVALID_STATUS', 'Campaign cannot be cancelled', 400)

    await this._campaignRepository.updateStatus(dto.campaignId, 'cancelled')
  }
}
