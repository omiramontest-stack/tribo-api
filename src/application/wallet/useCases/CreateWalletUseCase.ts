import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { UseCase } from '../../common/UseCase.js'
import type { CreateWalletDto } from '../dto/CreateWalletDto.js'
import { randomUUID } from 'crypto'

export class CreateWalletUseCase implements UseCase<CreateWalletDto, Wallet> {
  constructor(private readonly _walletRepository: WalletRepository) {}

  async run(dto: CreateWalletDto): Promise<Wallet> {
    const wallet: Wallet = {
      id: randomUUID(),
      ...dto,
      logoUrl: dto.logoUrl ?? null,
      createdAt: new Date().toISOString(),
    }
    return this._walletRepository.save(wallet)
  }
}
