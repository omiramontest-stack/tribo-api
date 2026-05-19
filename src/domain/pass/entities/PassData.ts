export interface StampsData {
  type: 'stamps'
  currentStamps: number
}

export interface MembershipData {
  type: 'membership'
  memberSince: string
  expiresAt: string | null
  photoUrl: string | null
}

export interface PointsData {
  type: 'points'
  currentPoints: number
}

export interface CashbackData {
  type: 'cashback'
  balance: number
}

export interface DaypassData {
  type: 'daypass'
  used: boolean
}

export interface BundleData {
  type: 'bundle'
  remainingUses: number
}

export interface GiftCardData {
  type: 'giftcard'
  initialBalance: number
  currentBalance: number
}

export interface CouponData {
  type: 'coupon'
  used: boolean
  expiresAt: string | null
}

export type PassData = StampsData | MembershipData | PointsData | CashbackData | DaypassData | BundleData | GiftCardData | CouponData
