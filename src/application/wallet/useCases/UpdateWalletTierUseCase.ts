import type { WalletTierRepository } from '../../../domain/wallet/repository/WalletTierRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { WalletTier, UpgradeRule } from '../../../domain/wallet/entities/WalletTier.js'
import { unlockThreshold } from '../../../domain/wallet/entities/WalletTier.js'
import type { WalletRules } from '../../../domain/wallet/entities/WalletRules.js'
import type { WalletThemeOverrides } from '../../../domain/wallet/entities/WalletTheme.js'
import { mergeThemeOverrides } from '../../../domain/wallet/entities/WalletTheme.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'
import { assertThemeContrast } from '../utils/assertThemeContrast.js'

export interface UpdateWalletTierDto {
  id: string
  organizationId: string
  adminId: string
  name?: string
  rules?: WalletRules
  config?: WalletThemeOverrides | null
  unlockRule?: UpgradeRule
}

export class UpdateWalletTierUseCase implements UseCase<UpdateWalletTierDto, WalletTier> {
  constructor(
    private readonly _tierRepository: WalletTierRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: UpdateWalletTierDto): Promise<WalletTier> {
    const role = await this._orgRepository.getMemberRole(dto.adminId, dto.organizationId)
    if (!role || role === 'staff') throw new AppError('FORBIDDEN', 'Only owners and admins can manage tiers', 403)

    const tier = await this._tierRepository.findById(dto.id)
    if (!tier) throw new AppError('TIER_NOT_FOUND', 'Tier not found', 404)

    const wallet = await this._walletRepository.findById(tier.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    if (dto.rules && dto.rules.type !== wallet.type)
      throw new AppError('INVALID_INPUT', `Tier rules must be of type '${wallet.type}'`, 400)

    // Si cambia el umbral, debe seguir entre el del nivel previo y el siguiente.
    if (dto.unlockRule) {
      const siblings = await this._tierRepository.findByWalletId(tier.walletId)
      const prev = siblings.filter(t => t.level < tier.level).at(-1)
      const next = siblings.find(t => t.level > tier.level)
      const threshold = unlockThreshold(dto.unlockRule)

      const lowerBound = prev ? unlockThreshold(prev.unlockRule) : 0
      if (threshold <= lowerBound)
        throw new AppError('INVALID_INPUT', `Unlock threshold must be greater than the previous tier's (${lowerBound})`, 400)
      if (next && threshold >= unlockThreshold(next.unlockRule))
        throw new AppError('INVALID_INPUT', `Unlock threshold must be less than the next tier's (${unlockThreshold(next.unlockRule)})`, 400)
    }

    const updated: WalletTier = {
      ...tier,
      name: dto.name ?? tier.name,
      rules: dto.rules ?? tier.rules,
      config: dto.config !== undefined ? dto.config : tier.config,
      unlockRule: dto.unlockRule ?? tier.unlockRule,
    }

    assertThemeContrast(mergeThemeOverrides(wallet.theme, updated.config), wallet.primaryColor)

    return this._tierRepository.update(updated)
  }
}
