import type { WalletTierRepository } from '../../../domain/wallet/repository/WalletTierRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { WalletTier } from '../../../domain/wallet/entities/WalletTier.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface ListWalletTiersDto {
  walletId: string
  organizationId: string
  adminId: string
}

export class ListWalletTiersUseCase implements UseCase<ListWalletTiersDto, WalletTier[]> {
  constructor(
    private readonly _tierRepository: WalletTierRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: ListWalletTiersDto): Promise<WalletTier[]> {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const wallet = await this._walletRepository.findById(dto.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    return this._tierRepository.findByWalletId(dto.walletId)
  }
}
