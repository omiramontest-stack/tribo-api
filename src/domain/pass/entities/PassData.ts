export interface StampsData {
  type: 'stamps'
  currentStamps: number
}

export interface MembershipData {
  type: 'membership'
  memberSince: string
  expiresAt: string | null
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

export type PassData = StampsData | MembershipData | PointsData | CashbackData | DaypassData
