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
  | 'bundle_used'
  | 'giftcard_credited'
  | 'giftcard_redeemed'
  | 'coupon_redeemed'
  | 'wallet_upgraded'

export interface PassEvent {
  id: string
  organizationId: string
  walletId: string
  passId: string
  type: PassEventType
  /**
   * Nivel (tier) de la wallet en el que ocurrió el evento. `null`/ausente para
   * eventos previos a la introducción de tiers — se lee como Nivel 1.
   */
  tierLevel?: number | null
  metadata: Record<string, unknown> | null
  createdBy: string | null
  createdAt: string
}
