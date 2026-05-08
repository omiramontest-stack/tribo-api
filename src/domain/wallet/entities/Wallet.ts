import type { WalletRules } from './WalletRules.js'

export type WalletType = 'stamps' | 'membership' | 'points' | 'cashback' | 'daypass'

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
  createdAt: string
  deletedAt: string | null
}
