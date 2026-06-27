import type { PlatformBranding } from '../../domain/branding/PlatformBranding.js'
import { buildBrandingUrl } from '../../domain/branding/PlatformBranding.js'

const DEFAULT_BRANDING_URL = 'https://tribowallet.com'
const BRANDING_LABEL = 'Hecho con TriboWallet'

/** Puerto mínimo del PlanGuard que necesita el resolver (ISP). */
export interface BrandingPlanGate {
  checkBrandingVisible(organizationId: string): Promise<boolean>
}

/**
 * Resuelve el sello de plataforma para una organización según su plan. Devuelve
 * `null` cuando el plan incluye white-label (no se muestra sello).
 */
export class BrandingResolver {
  constructor(private readonly _planGate: BrandingPlanGate) {}

  async resolve(organizationId: string): Promise<PlatformBranding | null> {
    const visible = await this._planGate.checkBrandingVisible(organizationId)
    if (!visible) return null

    const baseUrl = process.env.PLATFORM_BRANDING_URL ?? DEFAULT_BRANDING_URL
    return { label: BRANDING_LABEL, url: buildBrandingUrl(baseUrl, organizationId) }
  }
}
