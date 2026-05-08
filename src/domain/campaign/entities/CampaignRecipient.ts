export type CampaignRecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface CampaignRecipient {
  id: string
  campaignId: string
  passId: string
  phone: string | null
  email: string | null
  pushToken: string | null
  variables: Record<string, string>
  status: CampaignRecipientStatus
  sentAt: string | null
  error: string | null
  createdAt: string
}
