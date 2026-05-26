export type StampIcon =
  | 'check'
  | 'star'
  | 'heart'
  | 'bolt'
  | 'fire'
  | 'crown'
  | 'coffee'
  | 'pizza'
  | 'beer'
  | 'paw'
  | 'burger'
  | 'gem'
  | 'gift'
  | 'music'
  | 'leaf'
  | 'icecream'
  | 'flower'
  | 'custom'

export interface StampsRules {
  type: 'stamps'
  totalStamps: number
  reward: string
  stampIcon?: StampIcon
  /**
   * SVG completo (con la etiqueta `<svg viewBox="...">…</svg>`) que se usa como ícono
   * cuando `stampIcon === 'custom'`. Se incrusta escalado y centrado dentro del círculo.
   */
  stampCustomSvg?: string
  expiresInDays: number | null
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
  expiresInDays: number | null
}

export interface CashbackRules {
  type: 'cashback'
  cashbackPercent: number
  currency: string
  expiresInDays: number | null
}

export interface DaypassRules {
  type: 'daypass'
  eventName: string
  eventDate: string
  venue: string
  imageUrl: string | null
}

export interface BundleRules {
  type: 'bundle'
  totalUses: number
  label: string
  expiresInDays: number | null
}

export interface GiftCardRules {
  type: 'giftcard'
  initialBalance: number
  currency: string
  expiresInDays: number | null
}

export interface CouponRules {
  type: 'coupon'
  discount: number
  discountType: 'percent' | 'fixed'
  currency?: string
  expiresInDays: number | null
}

export type WalletRules = StampsRules | MembershipRules | PointsRules | CashbackRules | DaypassRules | BundleRules | GiftCardRules | CouponRules
