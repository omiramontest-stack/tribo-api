import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { SegmentResolverService } from '../services/SegmentResolverService.js'
import type { BillingRepository } from '../../../domain/billing/repository/BillingRepository.js'
import type { CampaignChannel } from '../../../domain/campaign/entities/Campaign.js'
import { isValidSegment } from '../../../domain/campaign/entities/Segment.js'
import { countSmsSegments, MAX_SMS_SEGMENTS } from '../services/TemplateEngine.js'
import { AppError } from '../../common/AppError.js'

export interface PreviewAudienceDto {
  organizationId: string
  adminId: string
  segment: unknown
  channel?: CampaignChannel
  messageTemplate?: string
}

export interface AudiencePreview {
  count: number
  sample: { firstName: string; lastName: string; phone: string }[]
  smsCost?: {
    segmentsPerMessage: number
    creditsNeeded: number
    creditsAvailable: number
    hasEnough: boolean
    exceedsLimit: boolean
  }
}

export class PreviewAudienceUseCase {
  constructor(
    private readonly _orgRepository: OrganizationRepository,
    private readonly _segmentResolver: SegmentResolverService,
    private readonly _billingRepository: BillingRepository,
  ) {}

  async run(dto: PreviewAudienceDto): Promise<AudiencePreview> {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    if (!isValidSegment(dto.segment)) throw new AppError('INVALID_SEGMENT', 'Invalid segment type', 400)

    const passes = await this._segmentResolver.resolve(dto.segment, dto.organizationId)

    const result: AudiencePreview = {
      count: passes.length,
      sample: passes.slice(0, 5).map((p) => ({ firstName: p.firstName, lastName: p.lastName, phone: p.phone })),
    }

    if (dto.channel === 'sms' && dto.messageTemplate) {
      // Count segments on the raw template (variables as literal chars) — predictable and consistent
      const segmentsPerMessage = countSmsSegments(dto.messageTemplate)
      const creditsNeeded = passes.length * segmentsPerMessage
      const creditsAvailable = await this._billingRepository.findSmsCreditsByOrg(dto.organizationId)
      result.smsCost = {
        segmentsPerMessage,
        creditsNeeded,
        creditsAvailable,
        hasEnough: creditsAvailable >= creditsNeeded,
        exceedsLimit: segmentsPerMessage > MAX_SMS_SEGMENTS,
      }
    }

    return result
  }
}
