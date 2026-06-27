import type { WalletTierRepository } from '../../../domain/wallet/repository/WalletTierRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface DeleteWalletTierDto {
  id: string
  organizationId: string
  adminId: string
}

export class DeleteWalletTierUseCase implements UseCase<DeleteWalletTierDto, void> {
  constructor(
    private readonly _tierRepository: WalletTierRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: DeleteWalletTierDto): Promise<void> {
    const role = await this._orgRepository.getMemberRole(dto.adminId, dto.organizationId)
    if (!role || role === 'staff') throw new AppError('FORBIDDEN', 'Only owners and admins can manage tiers', 403)

    const tier = await this._tierRepository.findById(dto.id)
    if (!tier) throw new AppError('TIER_NOT_FOUND', 'Tier not found', 404)

    const wallet = await this._walletRepository.findById(tier.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    // Solo se borra el nivel más alto: eliminar uno intermedio rompería la
    // contigüidad y dejaría huérfanos a los pases de niveles superiores.
    const siblings = await this._tierRepository.findByWalletId(tier.walletId)
    const isHighest = siblings.every(t => t.level <= tier.level)
    if (!isHighest)
      throw new AppError('INVALID_INPUT', 'Delete the higher tiers first', 400)

    await this._tierRepository.delete(dto.id)
  }
}
