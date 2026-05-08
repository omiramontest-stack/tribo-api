import { randomUUID } from 'crypto'
import type { PrismaClient } from '@prisma/client'
import type { CampaignRepository } from '../../../domain/campaign/repository/CampaignRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { SegmentResolverService } from '../services/SegmentResolverService.js'
import type { CampaignRecipient } from '../../../domain/campaign/entities/CampaignRecipient.js'
import { buildVariables } from '../services/TemplateEngine.js'
import { AppError } from '../../common/AppError.js'

export interface ScheduleCampaignDto {
  campaignId: string
  organizationId: string
  adminId: string
  scheduledAt: string
}

const CHUNK_SIZE = 500

export class ScheduleCampaignUseCase {
  constructor(
    private readonly _campaignRepository: CampaignRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _segmentResolver: SegmentResolverService,
    private readonly _db: PrismaClient,
  ) {}

  async run(dto: ScheduleCampaignDto): Promise<void> {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const campaign = await this._campaignRepository.findById(dto.campaignId)
    if (!campaign || campaign.organizationId !== dto.organizationId)
      throw new AppError('CAMPAIGN_NOT_FOUND', 'Campaign not found', 404)

    if (campaign.status !== 'draft')
      throw new AppError('INVALID_STATUS', 'Only draft campaigns can be scheduled', 400)

    if (new Date(dto.scheduledAt) <= new Date())
      throw new AppError('INVALID_DATE', 'scheduledAt must be in the future', 400)

    const passes = await this._segmentResolver.resolve(campaign.segment, dto.organizationId)

    const org = await this._orgRepository.findById(dto.organizationId)
    const orgName = org?.name ?? ''

    const recipients: CampaignRecipient[] = await Promise.all(
      passes.map(async (pass) => {
        const wallet = pass.walletId
          ? (await this._walletRepository.findById(pass.walletId)) ?? { businessName: '', rules: {}, type: 'stamps' as const, id: '', organizationId: '', primaryColor: '', accentColor: '', description: '', logoUrl: null, createdAt: '', deletedAt: null }
          : { businessName: '', rules: {}, type: 'stamps' as const, id: '', organizationId: '', primaryColor: '', accentColor: '', description: '', logoUrl: null, createdAt: '', deletedAt: null }

        let pushToken: string | null = null
        if (campaign.channel === 'wallet_push') {
          const reg = await this._db.deviceRegistration.findFirst({
            where: { passToken: pass.token },
            select: { pushToken: true },
          })
          pushToken = reg?.pushToken ?? null
        }

        return {
          id: randomUUID(),
          campaignId: campaign.id,
          passId: pass.id,
          phone: pass.phone,
          email: pass.email ?? null,
          pushToken,
          variables: buildVariables(pass, wallet as Parameters<typeof buildVariables>[1], orgName),
          status: 'pending' as const,
          sentAt: null,
          error: null,
          createdAt: new Date().toISOString(),
        }
      }),
    )

    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      await this._campaignRepository.saveRecipients(recipients.slice(i, i + CHUNK_SIZE))
    }

    await this._campaignRepository.update({ ...campaign, scheduledAt: dto.scheduledAt, status: 'scheduled' })
    await this._campaignRepository.updateTotalRecipients(campaign.id, recipients.length)
  }
}
