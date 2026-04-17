import type { Pass } from '../entities/Pass.js'

export interface PassRepository {
  findByToken(token: string): Promise<Pass | null>
  findByWalletId(walletId: string): Promise<Pass[]>
  save(pass: Pass): Promise<Pass>
  update(pass: Pass): Promise<Pass>
}
