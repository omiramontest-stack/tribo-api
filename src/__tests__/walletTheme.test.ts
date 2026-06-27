/**
 * Tests — WalletTheme (resolución de defaults, merge y contraste WCAG)
 */
import { describe, it, expect } from 'bun:test'
import {
  resolveWalletTheme,
  mergeThemeOverrides,
  customTextContrastViolations,
} from '../domain/wallet/entities/WalletTheme.js'

const base = { primaryColor: '#1A1A1A', accentColor: '#FF0000', logoUrl: null }

describe('resolveWalletTheme', () => {
  it('preserves legacy behaviour with no overrides', () => {
    const t = resolveWalletTheme({ ...base, theme: null })
    expect(t.colors.background).toBe('#1A1A1A')
    expect(t.colors.foreground).toBe('#FFFFFF')
    expect(t.colors.label).toBe('#FFFFFF')
    expect(t.colors.accent).toBe('#FF0000')
    expect(t.barcode.format).toBe('qr')
    expect(t.typography.fontKey).toBe('system')
  })

  it('applies overrides over the derived defaults', () => {
    const t = resolveWalletTheme({ ...base, theme: { colors: { foreground: '#000000' }, barcode: { format: 'pdf417' } } })
    expect(t.colors.foreground).toBe('#000000')
    expect(t.colors.background).toBe('#1A1A1A') // sin override → default
    expect(t.barcode.format).toBe('pdf417')
  })
})

describe('mergeThemeOverrides', () => {
  it('lets the override win per field while inheriting the rest', () => {
    const merged = mergeThemeOverrides(
      { colors: { foreground: '#111111', accent: '#222222' } },
      { colors: { accent: '#333333' } },
    )
    expect(merged.colors?.foreground).toBe('#111111') // heredado de base
    expect(merged.colors?.accent).toBe('#333333') // override gana
  })
})

describe('customTextContrastViolations', () => {
  it('ignores the default white text (handled by the render WCAG guard)', () => {
    expect(customTextContrastViolations(null, '#FFFFFF')).toEqual([])
    expect(customTextContrastViolations({ colors: {} }, '#FFFFFF')).toEqual([])
  })

  it('flags a custom foreground with insufficient contrast', () => {
    // gris claro sobre fondo blanco → ilegible
    const v = customTextContrastViolations({ colors: { foreground: '#DDDDDD' } }, '#FFFFFF')
    expect(v).toHaveLength(1)
    expect(v[0].field).toBe('foreground')
    expect(v[0].ratio).toBeLessThan(4.5)
  })

  it('accepts a custom foreground with enough contrast', () => {
    const v = customTextContrastViolations({ colors: { foreground: '#000000' } }, '#FFFFFF')
    expect(v).toEqual([])
  })

  it('uses the overridden background when evaluating contrast', () => {
    // texto blanco sobre fondo blanco custom → ilegible
    const v = customTextContrastViolations({ colors: { foreground: '#FFFFFF', background: '#FFFFFF' } }, '#1A1A1A')
    expect(v.map(x => x.field)).toContain('foreground')
  })
})
