export type PassEventType =
  | 'pass_created'
  | 'pass_deleted'
  | 'link_sent'
  | 'stamp_added'
  | 'stamp_redeemed'
  | 'points_added'
  | 'points_redeemed'
  | 'cashback_added'
  | 'cashback_redeemed'
  | 'membership_renewed'
  | 'daypass_scanned'

export interface PassEvent {
  id: string
  organizationId: string
  walletId: string
  passId: string
  type: PassEventType
  metadata: Record<string, unknown> | null
  createdBy: string | null
  createdAt: string
}
