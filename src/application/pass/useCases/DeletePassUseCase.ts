import { randomUUID } from 'crypto'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { PassEventRepository } from '../../../domain/analytics/repository/PassEventRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface DeletePassDto {
  token: string
  adminId: string
  organizationId: string
}

export class DeletePassUseCase implements UseCase<DeletePassDto, void> {
  constructor(
    private readonly _passRepository: PassRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _passEventRepository: PassEventRepository,
  ) {}

  async run(dto: DeletePassDto): Promise<void> {
    const pass = await this._passRepository.findByToken(dto.token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const role = await this._orgRepository.getMemberRole(dto.adminId, dto.organizationId)
    if (!role || role === 'staff') throw new AppError('FORBIDDEN', 'Only owners and admins can delete passes', 403)

    await this._passRepository.delete(pass.id)

    await this._passEventRepository.save({
      id: randomUUID(),
      organizationId: dto.organizationId,
      walletId: pass.walletId,
      passId: pass.id,
      type: 'pass_deleted',
      metadata: null,
      createdBy: dto.adminId,
      createdAt: new Date().toISOString(),
    })
  }
}
