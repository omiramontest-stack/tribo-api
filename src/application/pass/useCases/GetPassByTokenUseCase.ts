import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { EffectiveWalletResolver } from '../../wallet/services/EffectiveWalletResolver.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface PassWithWallet {
  pass: Pass
  wallet: Wallet
}

export class GetPassByTokenUseCase implements UseCase<string, PassWithWallet> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _passRepository: PassRepository,
    private readonly _effectiveWalletResolver: EffectiveWalletResolver,
  ) {}

  async run(token: string): Promise<PassWithWallet> {
    const pass = await this._passRepository.findByToken(token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    // Wallet efectiva: la vista web/frontend recibe el diseño (colores, tipografía,
    // reglas) del nivel actual del pase, no el de la wallet base.
    const effectiveWallet = await this._effectiveWalletResolver.resolve(wallet, pass)

    return { pass, wallet: effectiveWallet }
  }
}
