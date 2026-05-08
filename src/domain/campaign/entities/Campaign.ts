import type { Segment } from './Segment.js'

export type CampaignChannel = 'sms' | 'email' | 'wallet_push'
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'

export interface Campaign {
  id: string
  organizationId: string
  walletId: string | null
  name: string
  description: string | null
  channel: CampaignChannel
  status: CampaignStatus
  segment: Segment
  messageTemplate: string
  scheduledAt: string | null
  sentAt: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  totalRecipients: number
  totalSent: number
  totalFailed: number
}
