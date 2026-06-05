import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import { AppError } from '../../common/AppError.js'

export interface UnarchivePassDto {
  token: string
  adminId: string
  organizationId: string
}

export class UnarchivePassUseCase implements UseCase<UnarchivePassDto, Pass> {
  constructor(
    private readonly _passRepository: PassRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: UnarchivePassDto): Promise<Pass> {
    const pass = await this._passRepository.findByToken(dto.token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    if (pass.status !== 'archived')
      throw new AppError('PASS_NOT_ARCHIVED', 'Only archived passes can be unarchived', 400)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== dto.organizationId)
      throw new AppError('FORBIDDEN', 'This pass does not belong to your organization', 403)

    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember)
      throw new AppError('FORBIDDEN', 'This pass does not belong to your organization', 403)

    pass.status = 'completed'
    return this._passRepository.update(pass)
  }
}
