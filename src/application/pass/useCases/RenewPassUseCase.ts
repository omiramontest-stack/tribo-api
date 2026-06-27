import { randomUUID } from 'crypto'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { WalletTierRepository } from '../../../domain/wallet/repository/WalletTierRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { PassEventRepository } from '../../../domain/analytics/repository/PassEventRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import type { RenewPassDto } from '../dto/RenewPassDto.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { StampsRules, BundleRules, PointsRules } from '../../../domain/wallet/entities/WalletRules.js'
import type { PassData } from '../../../domain/pass/entities/PassData.js'
import { passTierLevel, passCompletedCycles } from '../../../domain/pass/entities/PassData.js'
import { resolveTargetTierLevel, toEffectiveWallet } from '../../../domain/wallet/entities/WalletTier.js'
import type { PassEventType } from '../../../domain/analytics/entities/PassEvent.js'
import { AppError } from '../../common/AppError.js'
import { sendPassUpdateNotification } from '../../../infrastructure/apple/ApnsService.js'
import { updateGoogleWalletObject } from '../../../infrastructure/google/GoogleWalletService.js'

const RENEWABLE_TYPES = ['stamps', 'bundle', 'points'] as const
type RenewableType = typeof RENEWABLE_TYPES[number]

function isRenewable(type: string): type is RenewableType {
  return (RENEWABLE_TYPES as readonly string[]).includes(type)
}

// Evento de redención que se contabiliza al reclamar el premio y reiniciar el ciclo.
// `bundle` no emite redención aquí: cada uso (use_bundle) ya se contabilizó durante
// el ciclo, por lo que el reinicio es solo una recarga del paquete.
const REDEEM_EVENT: Record<RenewableType, PassEventType | null> = {
  stamps: 'stamp_redeemed',
  points: 'points_redeemed',
  bundle: null,
}

interface TierProgress {
  tierLevel: number
  completedCycles: number
}

function buildResetData(
  type: RenewableType,
  wallet: Wallet,
  tier: TierProgress,
): PassData {
  function calcExpiry(days: number | null): string | null {
    return days ? new Date(Date.now() + days * 86400000).toISOString() : null
  }

  if (type === 'stamps') {
    const rules = wallet.rules as StampsRules
    return { type: 'stamps', currentStamps: 0, expiresAt: calcExpiry(rules.expiresInDays), ...tier }
  }

  if (type === 'bundle') {
    const rules = wallet.rules as BundleRules
    return { type: 'bundle', remainingUses: rules.totalUses, expiresAt: calcExpiry(rules.expiresInDays), ...tier }
  }

  const rules = wallet.rules as PointsRules
  return { type: 'points', currentPoints: 0, expiresAt: calcExpiry(rules.expiresInDays), ...tier }
}

export class RenewPassUseCase implements UseCase<RenewPassDto, Pass> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _tierRepository: WalletTierRepository,
    private readonly _passRepository: PassRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _passEventRepository: PassEventRepository,
  ) {}

  async run(dto: RenewPassDto): Promise<Pass> {
    const pass = await this._passRepository.findByToken(dto.token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    if (pass.status !== 'completed')
      throw new AppError('PASS_NOT_COMPLETED', 'Only completed passes can be renewed', 400)

    if (!isRenewable(pass.data.type))
      throw new AppError('UNSUPPORTED_TYPE', `Pass type '${pass.data.type}' does not support renewal`, 400)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== dto.organizationId)
      throw new AppError('FORBIDDEN', 'This pass does not belong to your organization', 403)

    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember)
      throw new AppError('FORBIDDEN', 'This pass does not belong to your organization', 403)

    // Reinicio in-place: conservamos id/token/authToken para que el pase YA instalado
    // (Apple/Google) se actualice por push, sin obligar al cliente a re-descargarlo.
    const type = pass.data.type as RenewableType
    const fromLevel = passTierLevel(pass.data)
    const completedCycles = passCompletedCycles(pass.data) + 1

    // Motor de upgrade: el ciclo recién completado puede desbloquear un nivel superior.
    // El reinicio usa las reglas del nivel RESULTANTE (ej. menos sellos en el Nivel 2).
    const tiers = await this._tierRepository.findByWalletId(wallet.id)
    const toLevel = Math.max(fromLevel, resolveTargetTierLevel(completedCycles, tiers))
    const effectiveWallet = toEffectiveWallet(wallet, tiers, toLevel)
    const upgraded = toLevel > fromLevel

    pass.data = buildResetData(type, effectiveWallet, { tierLevel: toLevel, completedCycles })
    pass.status = 'active'

    const saved = await this._passRepository.update(pass)

    const now = new Date().toISOString()
    const redeemEvent = REDEEM_EVENT[type]
    const pushTokens = await this._passRepository.findPushTokensByPassToken(saved.token)

    await Promise.allSettled([
      sendPassUpdateNotification(pushTokens),
      updateGoogleWalletObject(effectiveWallet, saved),
      // Redención contabilizada en el nivel donde se ganó el premio (fromLevel).
      ...(redeemEvent
        ? [this._passEventRepository.save({
            id: randomUUID(),
            organizationId: dto.organizationId,
            walletId: saved.walletId,
            passId: saved.id,
            type: redeemEvent,
            tierLevel: fromLevel,
            metadata: { passType: type, cycleCompleted: true, completedCycles },
            createdBy: dto.adminId,
            createdAt: now,
          })]
        : []),
      // Evolución de nivel — alimenta el funnel de conversión de tiers.
      ...(upgraded
        ? [this._passEventRepository.save({
            id: randomUUID(),
            organizationId: dto.organizationId,
            walletId: saved.walletId,
            passId: saved.id,
            type: 'wallet_upgraded',
            tierLevel: toLevel,
            metadata: { from: fromLevel, to: toLevel, completedCycles },
            createdBy: dto.adminId,
            createdAt: now,
          })]
        : []),
    ])

    return saved
  }
}
