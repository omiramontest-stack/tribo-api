/**
 * Tests — BrandingResolver (gating por plan + atribución del enlace)
 */
import { describe, it, expect } from 'bun:test'
import { BrandingResolver } from '../application/branding/BrandingResolver.js'

const resolverWith = (visible: boolean) =>
  new BrandingResolver({ checkBrandingVisible: async () => visible })

describe('BrandingResolver', () => {
  it('returns the seal with ref + UTMs when the plan shows branding', async () => {
    const branding = await resolverWith(true).resolve('org-123')
    expect(branding).not.toBeNull()
    expect(branding!.label).toBe('Hecho con TriboWallet')
    expect(branding!.url).toContain('ref=org-123')
    expect(branding!.url).toContain('utm_source=wallet')
    expect(branding!.url).toContain('utm_campaign=powered_by')
  })

  it('returns null for white-label plans (branding hidden)', async () => {
    expect(await resolverWith(false).resolve('org-123')).toBeNull()
  })
})
