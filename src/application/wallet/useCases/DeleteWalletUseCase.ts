import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export class DeleteWalletUseCase implements UseCase<string, void> {
  constructor(private readonly _walletRepository: WalletRepository) {}

  async run(id: string): Promise<void> {
    const wallet = await this._walletRepository.findById(id)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    await this._walletRepository.delete(id)
  }
}
