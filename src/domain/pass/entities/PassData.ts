/**
 * Progreso del cliente dentro de la wallet, compartido por los tipos cíclicos
 * (stamps/points/bundle) que soportan reinicio y upgrade de nivel.
 *
 * Ambos campos son opcionales: los pases emitidos antes de los tiers no los
 * traen y se interpretan como Nivel 1 con 0 ciclos completados.
 */
export interface TierProgress {
  /** Nivel actual de la wallet para este pase. Ausente = Nivel 1. */
  tierLevel?: number
  /** Ciclos (canjes) completados. Alimenta la regla de upgrade. Ausente = 0. */
  completedCycles?: number
}

export interface StampsData extends TierProgress {
  type: 'stamps'
  currentStamps: number
  expiresAt?: string | null
}

export interface MembershipData {
  type: 'membership'
  memberSince: string
  expiresAt: string | null
  photoUrl: string | null
}

export interface PointsData extends TierProgress {
  type: 'points'
  currentPoints: number
  expiresAt?: string | null
}

export interface CashbackData {
  type: 'cashback'
  balance: number
  expiresAt?: string | null
}

export interface DaypassData {
  type: 'daypass'
  used: boolean
}

export interface BundleData extends TierProgress {
  type: 'bundle'
  remainingUses: number
  expiresAt?: string | null
}

export interface GiftCardData {
  type: 'giftcard'
  initialBalance: number
  currentBalance: number
  expiresAt?: string | null
}

export interface CouponData {
  type: 'coupon'
  used: boolean
  expiresAt: string | null
}

export type PassData = StampsData | MembershipData | PointsData | CashbackData | DaypassData | BundleData | GiftCardData | CouponData

/** Nivel base para pases sin tier asignado (pre-tiers o tipos no cíclicos). */
export const BASE_TIER_LEVEL = 1

/**
 * Lee el nivel actual del pase de forma segura. Devuelve {@link BASE_TIER_LEVEL}
 * cuando el tipo no soporta tiers o el pase aún no tiene nivel asignado.
 */
export function passTierLevel(data: PassData): number {
  return 'tierLevel' in data && typeof data.tierLevel === 'number'
    ? data.tierLevel
    : BASE_TIER_LEVEL
}

/** Ciclos (canjes) completados por el pase. 0 cuando no aplica o aún no tiene. */
export function passCompletedCycles(data: PassData): number {
  return 'completedCycles' in data && typeof data.completedCycles === 'number'
    ? data.completedCycles
    : 0
}
