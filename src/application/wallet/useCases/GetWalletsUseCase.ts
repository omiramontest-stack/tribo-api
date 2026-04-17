import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { UseCase } from '../../common/UseCase.js'

export class GetWalletsUseCase implements UseCase<void, Wallet[]> {
  constructor(private readonly _walletRepository: WalletRepository) {}

  async run(): Promise<Wallet[]> {
    return this._walletRepository.findAll()
  }
}
