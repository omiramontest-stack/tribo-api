import type { PrismaClient } from '@prisma/client'
import type { CampaignRepository } from '../../../domain/campaign/repository/CampaignRepository.js'
import type { Campaign } from '../../../domain/campaign/entities/Campaign.js'
import type { CampaignRecipient } from '../../../domain/campaign/entities/CampaignRecipient.js'
import type { CampaignStats } from '../../../domain/campaign/entities/CampaignStats.js'
import type { Segment } from '../../../domain/campaign/entities/Segment.js'
import type { PaginationParams, PaginatedResult } from '../../../application/common/Pagination.js'
import { paginate, toPaginatedResult } from '../../../application/common/Pagination.js'
import { PassEventType } from '@prisma/client'

const SCAN_TYPES: PassEventType[] = [
  'stamp_added', 'stamp_redeemed',
  'points_added', 'points_redeemed',
  'cashback_added', 'cashback_redeemed',
  'membership_renewed', 'daypass_scanned',
]

function toCampaign(r: Awaited<ReturnType<PrismaClient['campaign']['findUniqueOrThrow']>>): Campaign {
  return {
    id: r.id,
    organizationId: r.organizationId,
    walletId: r.walletId,
    name: r.name,
    description: r.description,
    channel: r.channel as Campaign['channel'],
    status: r.status as Campaign['status'],
    segment: r.segment as unknown as Segment,
    messageTemplate: r.messageTemplate,
    scheduledAt: r.scheduledAt?.toISOString() ?? null,
    sentAt: r.sentAt?.toISOString() ?? null,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString() ?? null,
    totalRecipients: r.totalRecipients,
    totalSent: r.totalSent,
    totalFailed: r.totalFailed,
  }
}

function toRecipient(r: Awaited<ReturnType<PrismaClient['campaignRecipient']['findUniqueOrThrow']>>): CampaignRecipient {
  return {
    id: r.id,
    campaignId: r.campaignId,
    passId: r.passId,
    phone: r.phone,
    email: r.email,
    pushToken: r.pushToken,
    variables: r.variables as Record<string, string>,
    status: r.status as CampaignRecipient['status'],
    sentAt: r.sentAt?.toISOString() ?? null,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
  }
}

export class CampaignPrismaRepository implements CampaignRepository {
  constructor(private readonly _db: PrismaClient) {}

  async save(campaign: Campaign): Promise<Campaign> {
    const r = await this._db.campaign.create({
      data: {
        id: campaign.id,
        organizationId: campaign.organizationId,
        walletId: campaign.walletId,
        name: campaign.name,
        description: campaign.description,
        channel: campaign.channel,
        status: campaign.status,
        segment: campaign.segment as object,
        messageTemplate: campaign.messageTemplate,
        scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt) : null,
        createdBy: campaign.createdBy,
      },
    })
    return toCampaign(r)
  }

  async update(campaign: Campaign): Promise<Campaign> {
    const r = await this._db.campaign.update({
      where: { id: campaign.id },
      data: {
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        segment: campaign.segment as object,
        messageTemplate: campaign.messageTemplate,
        scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt) : null,
        sentAt: campaign.sentAt ? new Date(campaign.sentAt) : null,
        totalRecipients: campaign.totalRecipients,
        totalSent: campaign.totalSent,
        totalFailed: campaign.totalFailed,
      },
    })
    return toCampaign(r)
  }

  async findById(id: string): Promise<Campaign | null> {
    const r = await this._db.campaign.findUnique({ where: { id } })
    return r ? toCampaign(r) : null
  }

  async findByOrg(organizationId: string, pagination: PaginationParams, status?: Campaign['status']): Promise<PaginatedResult<Campaign>> {
    const where = { organizationId, deletedAt: null, ...(status ? { status } : {}) }
    const { skip, take } = paginate(pagination)
    const [rows, total] = await Promise.all([
      this._db.campaign.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this._db.campaign.count({ where }),
    ])
    return toPaginatedResult(rows.map(toCampaign), total, pagination)
  }

  async findDueCampaigns(): Promise<Campaign[]> {
    const rows = await this._db.campaign.findMany({
      where: {
        status: { in: ['scheduled', 'sending'] },
        scheduledAt: { lte: new Date() },
        deletedAt: null,
      },
    })
    return rows.map(toCampaign)
  }

  async saveRecipients(recipients: CampaignRecipient[]): Promise<void> {
    await this._db.campaignRecipient.createMany({
      data: recipients.map((r) => ({
        id: r.id,
        campaignId: r.campaignId,
        passId: r.passId,
        phone: r.phone,
        email: r.email,
        pushToken: r.pushToken,
        variables: r.variables,
        status: r.status,
      })),
    })
  }

  async findPendingRecipients(campaignId: string, batchSize: number): Promise<CampaignRecipient[]> {
    const rows = await this._db.campaignRecipient.findMany({
      where: { campaignId, status: 'pending' },
      take: batchSize,
    })
    return rows.map(toRecipient)
  }

  async markRecipientSent(id: string): Promise<void> {
    await this._db.campaignRecipient.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date() },
    })
  }

  async markRecipientFailed(id: string, error: string): Promise<void> {
    await this._db.campaignRecipient.update({
      where: { id },
      data: { status: 'failed', error },
    })
  }

  async markRecipientSkipped(id: string): Promise<void> {
    await this._db.campaignRecipient.update({
      where: { id },
      data: { status: 'skipped' },
    })
  }

  async incrementStats(campaignId: string, sent: number, failed: number): Promise<void> {
    await this._db.campaign.update({
      where: { id: campaignId },
      data: { totalSent: { increment: sent }, totalFailed: { increment: failed } },
    })
  }

  async updateStatus(id: string, status: Campaign['status'], sentAt?: string): Promise<void> {
    await this._db.campaign.update({
      where: { id },
      data: { status, ...(sentAt ? { sentAt: new Date(sentAt) } : {}) },
    })
  }

  async updateTotalRecipients(id: string, total: number): Promise<void> {
    await this._db.campaign.update({ where: { id }, data: { totalRecipients: total } })
  }

  async getCampaignStats(campaignId: string, windowDays = 7): Promise<CampaignStats> {
    const [deliveryGroups, sentRecipients, campaign] = await Promise.all([
      this._db.campaignRecipient.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: true,
      }),
      this._db.campaignRecipient.findMany({
        where: { campaignId, status: 'sent' },
        select: { passId: true, sentAt: true },
      }),
      this._db.campaign.findUnique({ where: { id: campaignId }, select: { sentAt: true } }),
    ])

    const deliveryMap = new Map(deliveryGroups.map(g => [g.status, g._count]))
    const delivery = {
      sent: deliveryMap.get('sent') ?? 0,
      failed: deliveryMap.get('failed') ?? 0,
      skipped: deliveryMap.get('skipped') ?? 0,
    }

    if (!campaign?.sentAt || sentRecipients.length === 0) {
      return { delivery, conversions: 0, conversionRate: 0, avgHoursToConvert: null, windowDays }
    }

    const campaignSentAt = campaign.sentAt
    const windowEnd = new Date(campaignSentAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
    const passIds = sentRecipients.map(r => r.passId)

    const conversionEvents = await this._db.passEvent.findMany({
      where: { passId: { in: passIds }, type: { in: SCAN_TYPES }, createdAt: { gt: campaignSentAt, lte: windowEnd } },
      select: { passId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const firstConversionByPass = new Map<string, Date>()
    for (const e of conversionEvents) {
      if (!firstConversionByPass.has(e.passId)) firstConversionByPass.set(e.passId, e.createdAt)
    }

    const conversions = firstConversionByPass.size
    const conversionRate = Math.round((conversions / sentRecipients.length) * 1000) / 10

    let avgHoursToConvert: number | null = null
    if (conversions > 0) {
      const sentAtByPass = new Map(sentRecipients.map(r => [r.passId, r.sentAt ?? campaignSentAt]))
      let totalMs = 0
      for (const [passId, convertedAt] of firstConversionByPass) {
        const recipientSentAt = sentAtByPass.get(passId) ?? campaignSentAt
        totalMs += convertedAt.getTime() - new Date(recipientSentAt).getTime()
      }
      avgHoursToConvert = Math.round((totalMs / conversions / (60 * 60 * 1000)) * 10) / 10
    }

    return { delivery, conversions, conversionRate, avgHoursToConvert, windowDays }
  }
}
