import type { WalletType } from '../../../domain/wallet/entities/Wallet.js'
import type { WalletRules } from '../../../domain/wallet/entities/WalletRules.js'

export interface CreateWalletDto {
  organizationId: string
  adminId: string
  type: WalletType
  businessName: string
  logoUrl?: string | null
  primaryColor: string
  accentColor: string
  description: string
  rules: WalletRules
}
