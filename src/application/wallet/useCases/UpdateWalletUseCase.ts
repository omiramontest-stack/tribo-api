import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { WalletTierRepository } from '../../../domain/wallet/repository/WalletTierRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { WalletRules } from '../../../domain/wallet/entities/WalletRules.js'
import type { WalletThemeOverrides } from '../../../domain/wallet/entities/WalletTheme.js'
import { toEffectiveWallet } from '../../../domain/wallet/entities/WalletTier.js'
import { passTierLevel } from '../../../domain/pass/entities/PassData.js'
import type { BrandingResolver } from '../../branding/BrandingResolver.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'
import { assertThemeContrast } from '../utils/assertThemeContrast.js'
import { sendPassUpdateNotification } from '../../../infrastructure/apple/ApnsService.js'
import { updateGoogleWalletObject } from '../../../infrastructure/google/GoogleWalletService.js'

export interface UpdateWalletDto {
  id: string
  organizationId: string
  adminId: string
  businessName?: string
  logoUrl?: string | null
  primaryColor?: string
  accentColor?: string
  description?: string
  rules?: WalletRules
  businessRules?: string | null
  theme?: WalletThemeOverrides | null
}

export class UpdateWalletUseCase implements UseCase<UpdateWalletDto, Wallet> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _tierRepository: WalletTierRepository,
    private readonly _passRepository: PassRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _brandingResolver: BrandingResolver,
  ) {}

  async run(dto: UpdateWalletDto): Promise<Wallet> {
    // 1. Verificar permisos — solo owner/admin pueden editar wallets
    const role = await this._orgRepository.getMemberRole(dto.adminId, dto.organizationId)
    if (!role || role === 'staff') throw new AppError('FORBIDDEN', 'Only owners and admins can update wallets', 403)

    // 2. Obtener wallet existente
    const existing = await this._walletRepository.findById(dto.id)
    if (!existing) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    if (existing.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'This wallet does not belong to your organization', 403)

    // 3. Validar que las rules (si se envían) no cambien el tipo de la wallet
    if (dto.rules && dto.rules.type !== existing.type) {
      throw new AppError('INVALID_INPUT', `Cannot change wallet type from '${existing.type}' to '${dto.rules.type}'`, 400)
    }

    // 4. Aplicar cambios (merge parcial — solo los campos enviados)
    const updated: Wallet = {
      ...existing,
      businessName: dto.businessName ?? existing.businessName,
      logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : existing.logoUrl,
      primaryColor: dto.primaryColor ?? existing.primaryColor,
      accentColor: dto.accentColor ?? existing.accentColor,
      description: dto.description ?? existing.description,
      rules: dto.rules ?? existing.rules,
      businessRules: dto.businessRules !== undefined ? dto.businessRules : existing.businessRules,
      theme: dto.theme !== undefined ? dto.theme : existing.theme,
    }

    assertThemeContrast(updated.theme, updated.primaryColor)

    const saved = await this._walletRepository.update(updated)

    // 5. Notificar dispositivos en background (fire-and-forget)
    //    No bloqueamos la respuesta de la API — si falla el push, no falla el update.
    this._dispatchDeviceUpdates(saved).catch(() => { /* silenciado — ya logueado internamente */ })

    return saved
  }

  private async _dispatchDeviceUpdates(wallet: Wallet): Promise<void> {
    // Marcar passes como actualizados ANTES de notificar para que el endpoint Apple
    // /v1/devices/:deviceId/registrations filtre correctamente por passesUpdatedSince
    // y solo devuelva los passes de esta wallet, no los de otras wallets del dispositivo.
    await this._passRepository.touchAllByWalletId(wallet.id)

    const [passes, pushTokens, tiers, branding] = await Promise.all([
      this._passRepository.findAllByWalletId(wallet.id),
      this._passRepository.findAllPushTokensByWalletId(wallet.id),
      this._tierRepository.findByWalletId(wallet.id),
      this._brandingResolver.resolve(wallet.organizationId),
    ])

    if (!passes.length) return

    // Apple: un solo batch push — el iPhone llama al web service y descarga el .pkpass actualizado
    // Google: actualizar cada objeto individualmente, respetando el nivel de cada pase
    // (un pase en Nivel 2 conserva el diseño de su tier, no el de la wallet base).
    await Promise.allSettled([
      sendPassUpdateNotification(pushTokens),
      ...passes.map(pass => updateGoogleWalletObject(toEffectiveWallet(wallet, tiers, passTierLevel(pass.data)), pass, branding)),
    ])
  }
}
