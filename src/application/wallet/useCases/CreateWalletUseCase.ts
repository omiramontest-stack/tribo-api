import { randomUUID } from 'crypto'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { UseCase } from '../../common/UseCase.js'
import type { CreateWalletDto } from '../dto/CreateWalletDto.js'
import { AppError } from '../../common/AppError.js'

export class CreateWalletUseCase implements UseCase<CreateWalletDto, Wallet> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: CreateWalletDto): Promise<Wallet> {
    const role = await this._orgRepository.getMemberRole(dto.adminId, dto.organizationId)
    if (!role || role === 'staff') throw new AppError('FORBIDDEN', 'Only owners and admins can create wallets', 403)

    const wallet: Wallet = {
      id: randomUUID(),
      organizationId: dto.organizationId,
      type: dto.type,
      businessName: dto.businessName,
      logoUrl: dto.logoUrl ?? null,
      primaryColor: dto.primaryColor,
      accentColor: dto.accentColor,
      description: dto.description,
      rules: dto.rules,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    }
    return this._walletRepository.save(wallet)
  }
}
