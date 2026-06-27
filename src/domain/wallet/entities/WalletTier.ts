import type { Wallet } from './Wallet.js'
import type { WalletRules } from './WalletRules.js'
import type { WalletTheme, WalletThemeOverrides } from './WalletTheme.js'
import { resolveWalletTheme, mergeThemeOverrides } from './WalletTheme.js'

/** Nivel base implícito: la wallet sin filas de tier es el Nivel 1. */
export const BASE_TIER_LEVEL = 1

// ─── Reglas de upgrade ────────────────────────────────────────────────────────
// Unión discriminada para soportar nuevos tipos de regla en el futuro (gasto
// acumulado, antigüedad, etc.) sin tocar a los consumidores existentes.

export interface CyclesCompletedRule {
  type: 'cycles_completed'
  /** Ciclos (canjes) acumulados necesarios para desbloquear este nivel. */
  threshold: number
}

export type UpgradeRule = CyclesCompletedRule

/** Umbral comparable de una regla — punto de extensión por tipo de regla. */
export function unlockThreshold(rule: UpgradeRule): number {
  switch (rule.type) {
    case 'cycles_completed':
      return rule.threshold
  }
}

// ─── Entidad ──────────────────────────────────────────────────────────────────

export interface WalletTier {
  id: string
  walletId: string
  /** Nivel del tier. Siempre ≥ 2; el Nivel 1 es la wallet base implícita. */
  level: number
  name: string
  /** Reglas del nivel (mismo tipo que la wallet, ej. stamps con otros totalStamps). */
  rules: WalletRules
  /** Overrides visuales del nivel sobre el branding de la wallet. */
  config: WalletThemeOverrides | null
  /** Regla que debe cumplirse para que un pase alcance este nivel. */
  unlockRule: UpgradeRule
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

// ─── Resolución de nivel efectivo ───────────────────────────────────────────────

/** Nivel completamente resuelto que consume el render y el motor de upgrade. */
export interface ResolvedTier {
  level: number
  name: string
  rules: WalletRules
  theme: WalletTheme
}

/**
 * Resuelve el aspecto y reglas efectivos de un pase según su nivel.
 *
 * - Nivel 1 (o sin tier para ese nivel) → la wallet base.
 * - Nivel ≥ 2 → el tier correspondiente, con su config visual fusionada sobre el
 *   branding de la wallet y sus propias reglas.
 */
export function resolveTier(wallet: Wallet, tiers: WalletTier[], level: number): ResolvedTier {
  const tier = level > BASE_TIER_LEVEL
    ? tiers.find(t => t.level === level && t.deletedAt === null)
    : undefined

  if (!tier) {
    return {
      level: BASE_TIER_LEVEL,
      name: wallet.businessName,
      rules: wallet.rules,
      theme: resolveWalletTheme(wallet),
    }
  }

  return {
    level: tier.level,
    name: tier.name,
    rules: tier.rules,
    theme: resolveWalletTheme({ ...wallet, theme: mergeThemeOverrides(wallet.theme, tier.config) }),
  }
}

// ─── Motor de upgrade ───────────────────────────────────────────────────────────

/**
 * Nivel objetivo de un pase dado su progreso. Es el nivel más alto cuya regla de
 * desbloqueo ya se cumple; si ninguno aplica, el Nivel base. El llamador nunca
 * debe bajar de nivel: combinar con `Math.max(nivelActual, objetivo)`.
 */
export function resolveTargetTierLevel(completedCycles: number, tiers: WalletTier[]): number {
  return tiers
    .filter(t => t.deletedAt === null && unlockThreshold(t.unlockRule) <= completedCycles)
    .reduce((max, t) => Math.max(max, t.level), BASE_TIER_LEVEL)
}

/**
 * Proyecta el nivel resuelto sobre la forma `Wallet`, de modo que todo el pipeline
 * de render existente (builders Apple/Google) muestre el tier sin modificarse.
 *
 * El color de fondo se proyecta en `primaryColor` (no en el theme) para que el
 * guard WCAG de AppleWalletService lo siga oscureciendo si hiciera falta. En el
 * Nivel base devuelve la wallet intacta — comportamiento idéntico al previo.
 */
export function toEffectiveWallet(wallet: Wallet, tiers: WalletTier[], level: number): Wallet {
  const resolved = resolveTier(wallet, tiers, level)
  if (resolved.level === BASE_TIER_LEVEL) return wallet

  const { colors, typography, assets, barcode, back } = resolved.theme
  return {
    ...wallet,
    businessName: resolved.name,
    rules: resolved.rules,
    logoUrl: assets.logoUrl,
    primaryColor: colors.background,
    accentColor: colors.accent,
    theme: {
      // `background` se omite a propósito → PassBuilder cae al primaryColor seguro.
      colors: { foreground: colors.foreground, label: colors.label, accent: colors.accent, gradientTo: colors.gradientTo },
      typography,
      assets,
      barcode,
      back,
    },
  }
}
