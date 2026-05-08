import { randomUUID } from 'crypto'
import type { CampaignRepository } from '../../../domain/campaign/repository/CampaignRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { Campaign, CampaignChannel } from '../../../domain/campaign/entities/Campaign.js'
import type { Segment } from '../../../domain/campaign/entities/Segment.js'
import { isValidSegment } from '../../../domain/campaign/entities/Segment.js'
import { AppError } from '../../common/AppError.js'

export interface CreateCampaignDto {
  organizationId: string
  adminId: string
  name: string
  description?: string
  channel: CampaignChannel
  segment: unknown
  messageTemplate: string
  walletId?: string
}

export class CreateCampaignUseCase {
  constructor(
    private readonly _campaignRepository: CampaignRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _walletRepository: WalletRepository,
  ) {}

  async run(dto: CreateCampaignDto): Promise<Campaign> {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    if (!isValidSegment(dto.segment)) throw new AppError('INVALID_SEGMENT', 'Invalid segment type', 400)

    if (dto.walletId) {
      const wallet = await this._walletRepository.findById(dto.walletId)
      if (!wallet || wallet.organizationId !== dto.organizationId)
        throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    }

    const now = new Date().toISOString()
    const campaign: Campaign = {
      id: randomUUID(),
      organizationId: dto.organizationId,
      walletId: dto.walletId ?? null,
      name: dto.name,
      description: dto.description ?? null,
      channel: dto.channel,
      status: 'draft',
      segment: dto.segment as Segment,
      messageTemplate: dto.messageTemplate,
      scheduledAt: null,
      sentAt: null,
      createdBy: dto.adminId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      totalRecipients: 0,
      totalSent: 0,
      totalFailed: 0,
    }

    return this._campaignRepository.save(campaign)
  }
}
