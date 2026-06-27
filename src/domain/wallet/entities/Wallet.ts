import type { WalletRules } from './WalletRules.js'
import type { WalletThemeOverrides } from './WalletTheme.js'

export type WalletType = 'stamps' | 'membership' | 'points' | 'cashback' | 'daypass' | 'bundle' | 'giftcard' | 'coupon'

export interface Wallet {
  id: string
  organizationId: string
  type: WalletType
  businessName: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  description: string
  rules: WalletRules
  /** Términos, condiciones y reglas del negocio — se muestran en el reverso del pase. */
  businessRules: string | null
  /**
   * Personalización visual del negocio sobre los defaults derivados de
   * primaryColor/accentColor/logoUrl. `null` = sin overrides (render por defecto).
   * Resolver con {@link resolveWalletTheme} antes de usar.
   */
  theme: WalletThemeOverrides | null
  createdAt: string
  deletedAt: string | null
}
