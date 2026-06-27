import { randomUUID } from 'crypto'
import type { WalletTierRepository } from '../../../domain/wallet/repository/WalletTierRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { WalletTier, UpgradeRule } from '../../../domain/wallet/entities/WalletTier.js'
import { BASE_TIER_LEVEL, unlockThreshold } from '../../../domain/wallet/entities/WalletTier.js'
import type { WalletRules } from '../../../domain/wallet/entities/WalletRules.js'
import type { WalletThemeOverrides } from '../../../domain/wallet/entities/WalletTheme.js'
import { mergeThemeOverrides } from '../../../domain/wallet/entities/WalletTheme.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'
import { assertThemeContrast } from '../utils/assertThemeContrast.js'

export interface CreateWalletTierDto {
  walletId: string
  organizationId: string
  adminId: string
  level: number
  name: string
  rules: WalletRules
  config?: WalletThemeOverrides | null
  unlockRule: UpgradeRule
}

export class CreateWalletTierUseCase implements UseCase<CreateWalletTierDto, WalletTier> {
  constructor(
    private readonly _tierRepository: WalletTierRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: CreateWalletTierDto): Promise<WalletTier> {
    const role = await this._orgRepository.getMemberRole(dto.adminId, dto.organizationId)
    if (!role || role === 'staff') throw new AppError('FORBIDDEN', 'Only owners and admins can manage tiers', 403)

    const wallet = await this._walletRepository.findById(dto.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    // El tier no puede cambiar el tipo de la wallet — solo personaliza reglas/visual.
    if (dto.rules.type !== wallet.type)
      throw new AppError('INVALID_INPUT', `Tier rules must be of type '${wallet.type}'`, 400)

    const existing = await this._tierRepository.findByWalletId(dto.walletId)

    // Niveles contiguos a partir del 2: el siguiente nivel creable es maxNivel + 1.
    const highestLevel = existing.reduce((max, t) => Math.max(max, t.level), BASE_TIER_LEVEL)
    const nextLevel = highestLevel + 1
    if (dto.level !== nextLevel)
      throw new AppError('INVALID_INPUT', `Tiers must be created contiguously; next level is ${nextLevel}`, 400)

    // Umbral estrictamente creciente: un nivel superior exige más ciclos que el previo.
    const prevThreshold = existing.reduce(
      (acc, t) => (t.level === highestLevel ? unlockThreshold(t.unlockRule) : acc),
      0,
    )
    if (unlockThreshold(dto.unlockRule) <= prevThreshold)
      throw new AppError('INVALID_INPUT', `Unlock threshold must be greater than the previous tier's (${prevThreshold})`, 400)

    // El texto del nivel se valida sobre el fondo efectivo (config fusionado al branding).
    assertThemeContrast(mergeThemeOverrides(wallet.theme, dto.config ?? null), wallet.primaryColor)

    const now = new Date().toISOString()
    const tier: WalletTier = {
      id: randomUUID(),
      walletId: dto.walletId,
      level: dto.level,
      name: dto.name,
      rules: dto.rules,
      config: dto.config ?? null,
      unlockRule: dto.unlockRule,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    return this._tierRepository.save(tier)
  }
}
