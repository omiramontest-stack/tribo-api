import type { WalletTierRepository } from '../../../domain/wallet/repository/WalletTierRepository.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import { BASE_TIER_LEVEL, toEffectiveWallet } from '../../../domain/wallet/entities/WalletTier.js'
import { passTierLevel } from '../../../domain/pass/entities/PassData.js'

/**
 * Resuelve la "wallet efectiva" de un pase: la wallet proyectada al nivel (tier)
 * en el que se encuentra el pase, lista para alimentar el pipeline de render.
 *
 * Optimización clave: si el pase está en el Nivel base (todos los pases previos a
 * los tiers), devuelve la wallet sin consultar la tabla de tiers — coste cero para
 * todo lo que ya existe en producción.
 */
export class EffectiveWalletResolver {
  constructor(private readonly _tierRepository: WalletTierRepository) {}

  async resolve(wallet: Wallet, pass: Pass): Promise<Wallet> {
    const level = passTierLevel(pass.data)
    if (level <= BASE_TIER_LEVEL) return wallet

    const tiers = await this._tierRepository.findByWalletId(wallet.id)
    return toEffectiveWallet(wallet, tiers, level)
  }
}
