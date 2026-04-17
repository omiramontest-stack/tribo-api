import type { WalletRules } from './WalletRules.js'

export type WalletType = 'stamps' | 'membership' | 'points'

export interface Wallet {
  id: string
  type: WalletType
  businessName: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  description: string
  rules: WalletRules
  createdAt: string
}
