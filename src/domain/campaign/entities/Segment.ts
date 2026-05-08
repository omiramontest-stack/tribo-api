export interface SegmentAllOrg {
  type: 'all_org'
}

export interface SegmentAllWallet {
  type: 'all_wallet'
  walletId: string
}

export interface SegmentNearCompletion {
  type: 'near_completion'
  walletId: string
  thresholdPercent: number
}

export interface SegmentInactive {
  type: 'inactive'
  walletId?: string
  inactiveDays: number
}

export interface SegmentNeverRedeemed {
  type: 'never_redeemed'
  walletId?: string
}

export interface SegmentCashbackBalanceGte {
  type: 'cashback_balance_gte'
  walletId: string
  minBalance: number
}

export interface SegmentFrequentVisitors {
  type: 'frequent_visitors'
  walletId?: string
  minEvents: number
  withinDays?: number
}

export interface SegmentNewCustomers {
  type: 'new_customers'
  walletId?: string
  withinDays: number
}

export type Segment =
  | SegmentAllOrg
  | SegmentAllWallet
  | SegmentNearCompletion
  | SegmentInactive
  | SegmentNeverRedeemed
  | SegmentCashbackBalanceGte
  | SegmentFrequentVisitors
  | SegmentNewCustomers

export const SEGMENT_TYPES = [
  'all_org',
  'all_wallet',
  'near_completion',
  'inactive',
  'never_redeemed',
  'cashback_balance_gte',
  'frequent_visitors',
  'new_customers',
] as const

export function isValidSegment(value: unknown): value is Segment {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return SEGMENT_TYPES.includes(obj.type as typeof SEGMENT_TYPES[number])
}
