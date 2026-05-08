export interface StampsRules {
  type: 'stamps'
  totalStamps: number
  reward: string
}

export interface MembershipRules {
  type: 'membership'
  level: string
  expiresInDays: number | null
}

export interface PointsRules {
  type: 'points'
  pointsLabel: string
  reward: string
  rewardThreshold: number
}

export interface CashbackRules {
  type: 'cashback'
  cashbackPercent: number
  currency: string
}

export interface DaypassRules {
  type: 'daypass'
  eventName: string
  eventDate: string
  venue: string
  imageUrl: string | null
}

export type WalletRules = StampsRules | MembershipRules | PointsRules | CashbackRules | DaypassRules
