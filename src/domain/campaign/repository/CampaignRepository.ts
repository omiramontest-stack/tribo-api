import type { Campaign } from '../entities/Campaign.js'
import type { CampaignRecipient } from '../entities/CampaignRecipient.js'
import type { CampaignStats } from '../entities/CampaignStats.js'
import type { PaginationParams, PaginatedResult } from '../../../application/common/Pagination.js'

export interface CampaignRepository {
  save(campaign: Campaign): Promise<Campaign>
  update(campaign: Campaign): Promise<Campaign>
  findById(id: string): Promise<Campaign | null>
  findByOrg(organizationId: string, pagination: PaginationParams, status?: Campaign['status']): Promise<PaginatedResult<Campaign>>
  findDueCampaigns(): Promise<Campaign[]>
  saveRecipients(recipients: CampaignRecipient[]): Promise<void>
  findPendingRecipients(campaignId: string, batchSize: number): Promise<CampaignRecipient[]>
  markRecipientSent(id: string): Promise<void>
  markRecipientFailed(id: string, error: string): Promise<void>
  markRecipientSkipped(id: string): Promise<void>
  incrementStats(campaignId: string, sent: number, failed: number): Promise<void>
  updateStatus(id: string, status: Campaign['status'], sentAt?: string): Promise<void>
  updateTotalRecipients(id: string, total: number): Promise<void>
  getCampaignStats(campaignId: string, windowDays?: number): Promise<CampaignStats>
}
