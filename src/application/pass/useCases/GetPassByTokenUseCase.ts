import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { PlatformBranding } from '../../../domain/branding/PlatformBranding.js'
import type { EffectiveWalletResolver } from '../../wallet/services/EffectiveWalletResolver.js'
import type { BrandingResolver } from '../../branding/BrandingResolver.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface PassWithWallet {
  pass: Pass
  wallet: Wallet
  /** Sello de plataforma para el footer de la vista web (null si el plan lo oculta). */
  branding?: PlatformBranding | null
}

export class GetPassByTokenUseCase implements UseCase<string, PassWithWallet> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _passRepository: PassRepository,
    private readonly _effectiveWalletResolver: EffectiveWalletResolver,
    private readonly _brandingResolver: BrandingResolver,
  ) {}

  async run(token: string): Promise<PassWithWallet> {
    const pass = await this._passRepository.findByToken(token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    // Wallet efectiva: la vista web/frontend recibe el diseño (colores, tipografía,
    // reglas) del nivel actual del pase, no el de la wallet base.
    const [effectiveWallet, branding] = await Promise.all([
      this._effectiveWalletResolver.resolve(wallet, pass),
      this._brandingResolver.resolve(wallet.organizationId),
    ])

    return { pass, wallet: effectiveWallet, branding }
  }
}
