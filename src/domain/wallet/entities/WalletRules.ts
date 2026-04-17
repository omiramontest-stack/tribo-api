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

export type WalletRules = StampsRules | MembershipRules | PointsRules
