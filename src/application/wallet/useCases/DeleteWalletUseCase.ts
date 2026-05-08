import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export class DeleteWalletUseCase implements UseCase<{ id: string; adminId: string; organizationId: string }, void> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _passRepository: PassRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run({ id, adminId, organizationId }: { id: string; adminId: string; organizationId: string }): Promise<void> {
    const wallet = await this._walletRepository.findById(id)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const role = await this._orgRepository.getMemberRole(adminId, organizationId)
    if (!role || role === 'staff') throw new AppError('FORBIDDEN', 'Only owners and admins can delete wallets', 403)

    await this._passRepository.deleteByWalletId(id)
    await this._walletRepository.delete(id)
  }
}
