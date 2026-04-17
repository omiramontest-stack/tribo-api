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

export type PassData = StampsData | MembershipData | PointsData
