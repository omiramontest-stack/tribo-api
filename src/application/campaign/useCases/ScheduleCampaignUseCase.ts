import { randomUUID } from 'crypto'
import type { CampaignRepository } from '../../../domain/campaign/repository/CampaignRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
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
    private readonly _passRepository: PassRepository,
    private readonly _segmentResolver: SegmentResolverService,
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

    // ── Cargar wallets en batch (1 query por walletId único, no 1 por pass) ──────
    const uniqueWalletIds = [...new Set(passes.map(p => p.walletId).filter(Boolean))]
    const walletMap = new Map<string, Parameters<typeof buildVariables>[1]>()
    await Promise.all(
      uniqueWalletIds.map(async (wid) => {
        const w = await this._walletRepository.findById(wid)
        if (w) walletMap.set(wid, w)
      }),
    )
    const emptyWallet: Parameters<typeof buildVariables>[1] = {
      businessName: '',
      rules: { type: 'stamps', totalStamps: 0, reward: '', expiresInDays: null },
      type: 'stamps' as const,
      id: '', organizationId: '', primaryColor: '', accentColor: '',
      description: '', logoUrl: null, createdAt: '', deletedAt: null,
    }

    // ── Cargar push tokens en batch (1 sola query IN, no 1 por pass) ────────────
    const pushTokenMap = campaign.channel === 'wallet_push'
      ? await this._passRepository.findPushTokensByPassTokens(passes.map(p => p.token))
      : new Map<string, string>()

    const recipients: CampaignRecipient[] = passes.map((pass) => {
      const wallet = walletMap.get(pass.walletId) ?? emptyWallet
      const pushToken = campaign.channel === 'wallet_push'
        ? (pushTokenMap.get(pass.token) ?? null)
        : null

      return {
        id: randomUUID(),
        campaignId: campaign.id,
        passId: pass.id,
        phone: pass.phone,
        email: pass.email ?? null,
        pushToken,
        variables: buildVariables(pass, wallet, orgName),
        status: 'pending' as const,
        sentAt: null,
        error: null,
        createdAt: new Date().toISOString(),
      }
    })

    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      await this._campaignRepository.saveRecipients(recipients.slice(i, i + CHUNK_SIZE))
    }

    await this._campaignRepository.update({ ...campaign, scheduledAt: dto.scheduledAt, status: 'scheduled' })
    await this._campaignRepository.updateTotalRecipients(campaign.id, recipients.length)
  }
}
