import type { WalletTier } from '../entities/WalletTier.js'

export interface WalletTierRepository {
  /** Tiers vivos de la wallet, ordenados por nivel ascendente. */
  findByWalletId(walletId: string): Promise<WalletTier[]>
  /** True si alguna wallet de la organización tiene tiers configurados. */
  existsForOrganization(organizationId: string): Promise<boolean>
  findById(id: string): Promise<WalletTier | null>
  save(tier: WalletTier): Promise<WalletTier>
  update(tier: WalletTier): Promise<WalletTier>
  /** Soft delete — preserva el histórico para auditoría. */
  delete(id: string): Promise<void>
}
