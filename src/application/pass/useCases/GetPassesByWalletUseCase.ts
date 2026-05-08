import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { PaginationParams, PaginatedResult } from '../../common/Pagination.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import { AppError } from '../../common/AppError.js'

export interface GetPassesByWalletDto {
  walletId: string
  adminId: string
  organizationId: string
  pagination: PaginationParams
}

export class GetPassesByWalletUseCase {
  constructor(
    private readonly _passRepository: PassRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: GetPassesByWalletDto): Promise<PaginatedResult<Pass>> {
    const wallet = await this._walletRepository.findById(dto.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    return this._passRepository.findByWalletId(dto.walletId, dto.pagination)
  }
}
