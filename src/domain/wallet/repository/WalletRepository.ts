import type { Wallet } from '../entities/Wallet.js'

export interface WalletRepository {
  findAll(organizationId: string): Promise<Wallet[]>
  countByOrganizationId(organizationId: string): Promise<number>
  findById(id: string): Promise<Wallet | null>
  save(wallet: Wallet): Promise<Wallet>
  delete(id: string): Promise<void>
}
