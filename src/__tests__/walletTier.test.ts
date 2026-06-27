/**
 * Tests — Wallet Upgrades / motor de tiers (lógica de dominio pura)
 *
 *   - resolveTargetTierLevel: decide a qué nivel debe estar un pase según sus ciclos
 *   - resolveTier: resuelve nombre/reglas/theme efectivos por nivel
 *   - toEffectiveWallet: proyecta el tier sobre la forma Wallet para el render
 */
import { describe, it, expect } from 'bun:test'
import type { Wallet } from '../domain/wallet/entities/Wallet.js'
import type { WalletTier } from '../domain/wallet/entities/WalletTier.js'
import {
  resolveTargetTierLevel,
  resolveTier,
  toEffectiveWallet,
  BASE_TIER_LEVEL,
} from '../domain/wallet/entities/WalletTier.js'

const wallet: Wallet = {
  id: 'w1',
  organizationId: 'org1',
  type: 'stamps',
  businessName: 'Duo Pass',
  logoUrl: null,
  primaryColor: '#1A1A1A',
  accentColor: '#FF0000',
  description: 'desc',
  rules: { type: 'stamps', totalStamps: 9, reward: 'Café', expiresInDays: null },
  businessRules: null,
  theme: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
}

function tier(level: number, threshold: number, over: Partial<WalletTier> = {}): WalletTier {
  return {
    id: `t${level}`,
    walletId: 'w1',
    level,
    name: `Duo Pass ${level}`,
    rules: { type: 'stamps', totalStamps: 6, reward: 'Café Plus', expiresInDays: null },
    config: null,
    unlockRule: { type: 'cycles_completed', threshold },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...over,
  }
}

describe('resolveTargetTierLevel', () => {
  const tiers = [tier(2, 3), tier(3, 6)]

  it('returns base level when there are no tiers', () => {
    expect(resolveTargetTierLevel(10, [])).toBe(BASE_TIER_LEVEL)
  })

  it('stays at base while below the first threshold', () => {
    expect(resolveTargetTierLevel(2, tiers)).toBe(BASE_TIER_LEVEL)
  })

  it('unlocks a tier exactly at its threshold', () => {
    expect(resolveTargetTierLevel(3, tiers)).toBe(2)
  })

  it('returns the highest tier whose threshold is met', () => {
    expect(resolveTargetTierLevel(7, tiers)).toBe(3)
  })

  it('ignores soft-deleted tiers', () => {
    expect(resolveTargetTierLevel(9, [tier(2, 3), tier(3, 6, { deletedAt: '2026-02-01T00:00:00.000Z' })])).toBe(2)
  })
})

describe('resolveTier', () => {
  it('falls back to the wallet base for level 1', () => {
    const r = resolveTier(wallet, [tier(2, 3)], 1)
    expect(r.level).toBe(BASE_TIER_LEVEL)
    expect(r.name).toBe('Duo Pass')
    expect((r.rules as { totalStamps: number }).totalStamps).toBe(9)
    expect(r.theme.colors.foreground).toBe('#FFFFFF')
  })

  it('resolves a configured level to its own name and rules', () => {
    const r = resolveTier(wallet, [tier(2, 3)], 2)
    expect(r.level).toBe(2)
    expect(r.name).toBe('Duo Pass 2')
    expect((r.rules as { totalStamps: number }).totalStamps).toBe(6)
  })

  it('merges tier config over the wallet branding', () => {
    const tiers = [tier(2, 3, { config: { colors: { foreground: '#000000', background: '#FFFFFF' } } })]
    const r = resolveTier(wallet, tiers, 2)
    expect(r.theme.colors.foreground).toBe('#000000')
    expect(r.theme.colors.background).toBe('#FFFFFF')
    // accent no fue sobreescrito por el tier → hereda el de la wallet
    expect(r.theme.colors.accent).toBe('#FF0000')
  })
})

describe('toEffectiveWallet', () => {
  it('returns the wallet untouched at base level', () => {
    expect(toEffectiveWallet(wallet, [tier(2, 3)], 1)).toBe(wallet)
  })

  it('projects tier rules, name and colors onto the wallet shape', () => {
    const tiers = [tier(2, 3, { config: { colors: { background: '#0000FF', accent: '#00FF00' } } })]
    const eff = toEffectiveWallet(wallet, tiers, 2)
    expect(eff.businessName).toBe('Duo Pass 2')
    expect((eff.rules as { totalStamps: number }).totalStamps).toBe(6)
    expect(eff.primaryColor).toBe('#0000FF')
    expect(eff.accentColor).toBe('#00FF00')
    // background se proyecta en primaryColor (no en theme) para preservar el guard WCAG
    expect(eff.theme?.colors?.background).toBeUndefined()
  })
})
