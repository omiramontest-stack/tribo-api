import type { Pass } from '../entities/Pass.js'
import type { PaginationParams, PaginatedResult } from '../../../application/common/Pagination.js'

export interface PassRepository {
  findByToken(token: string): Promise<Pass | null>
  countByOrganizationId(organizationId: string): Promise<number>
  findByWalletId(walletId: string, pagination: PaginationParams): Promise<PaginatedResult<Pass>>
  findScannedByWalletId(walletId: string, pagination: PaginationParams): Promise<PaginatedResult<Pass>>
  save(pass: Pass): Promise<Pass>
  update(pass: Pass): Promise<Pass>
  delete(id: string): Promise<void>
  deleteByWalletId(walletId: string): Promise<void>
}
