import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface GetWalletsDto {
  organizationId: string
  adminId: string
}

export class GetWalletsUseCase implements UseCase<GetWalletsDto, Wallet[]> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: GetWalletsDto): Promise<Wallet[]> {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)
    return this._walletRepository.findAll(dto.organizationId)
  }
}
