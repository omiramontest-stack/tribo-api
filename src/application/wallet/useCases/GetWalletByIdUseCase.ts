import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export class GetWalletByIdUseCase implements UseCase<string, Wallet> {
  constructor(private readonly _walletRepository: WalletRepository) {}

  async run(id: string): Promise<Wallet> {
    const wallet = await this._walletRepository.findById(id)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    return wallet
  }
}
