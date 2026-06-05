import { randomUUID } from 'crypto'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { PassEventRepository } from '../../../domain/analytics/repository/PassEventRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import type { RenewPassDto } from '../dto/RenewPassDto.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { StampsRules, BundleRules, PointsRules } from '../../../domain/wallet/entities/WalletRules.js'
import type { PassData } from '../../../domain/pass/entities/PassData.js'
import { AppError } from '../../common/AppError.js'
import { sendPassUpdateNotification } from '../../../infrastructure/apple/ApnsService.js'
import { updateGoogleWalletObject } from '../../../infrastructure/google/GoogleWalletService.js'

const RENEWABLE_TYPES = ['stamps', 'bundle', 'points'] as const
type RenewableType = typeof RENEWABLE_TYPES[number]

function isRenewable(type: string): type is RenewableType {
  return (RENEWABLE_TYPES as readonly string[]).includes(type)
}

function buildResetData(type: RenewableType, wallet: Awaited<ReturnType<WalletRepository['findById']>> & object): PassData {
  function calcExpiry(days: number | null): string | null {
    return days ? new Date(Date.now() + days * 86400000).toISOString() : null
  }

  if (type === 'stamps') {
    const rules = wallet.rules as StampsRules
    return { type: 'stamps', currentStamps: 0, expiresAt: calcExpiry(rules.expiresInDays) }
  }

  if (type === 'bundle') {
    const rules = wallet.rules as BundleRules
    return { type: 'bundle', remainingUses: rules.totalUses, expiresAt: calcExpiry(rules.expiresInDays) }
  }

  const rules = wallet.rules as PointsRules
  return { type: 'points', currentPoints: 0, expiresAt: calcExpiry(rules.expiresInDays) }
}

export class RenewPassUseCase implements UseCase<RenewPassDto, Pass> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _passRepository: PassRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _passEventRepository: PassEventRepository,
  ) {}

  async run(dto: RenewPassDto): Promise<Pass> {
    const oldPass = await this._passRepository.findByToken(dto.token)
    if (!oldPass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    if (oldPass.status !== 'completed')
      throw new AppError('PASS_NOT_COMPLETED', 'Only completed passes can be renewed', 400)

    if (!isRenewable(oldPass.data.type))
      throw new AppError('UNSUPPORTED_TYPE', `Pass type '${oldPass.data.type}' does not support renewal`, 400)

    const wallet = await this._walletRepository.findById(oldPass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== dto.organizationId)
      throw new AppError('FORBIDDEN', 'This pass does not belong to your organization', 403)

    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember)
      throw new AppError('FORBIDDEN', 'This pass does not belong to your organization', 403)

    const now = new Date().toISOString()
    const newPass: Pass = {
      id: randomUUID(),
      walletId: oldPass.walletId,
      token: randomUUID(),
      authToken: randomUUID(),
      firstName: oldPass.firstName,
      lastName: oldPass.lastName,
      phone: oldPass.phone,
      email: oldPass.email,
      data: buildResetData(oldPass.data.type as RenewableType, wallet),
      status: 'active',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    oldPass.status = 'archived'

    const [saved] = await Promise.all([
      this._passRepository.save(newPass),
      this._passRepository.update(oldPass),
    ])

    const pushTokens = await this._passRepository.findPushTokensByPassToken(oldPass.token)

    await Promise.allSettled([
      sendPassUpdateNotification(pushTokens),
      updateGoogleWalletObject(wallet, saved),
      this._passEventRepository.save({
        id: randomUUID(),
        organizationId: dto.organizationId,
        walletId: oldPass.walletId,
        passId: saved.id,
        type: 'pass_created',
        metadata: { passType: oldPass.data.type, renewedFrom: oldPass.id },
        createdBy: dto.adminId,
        createdAt: now,
      }),
    ])

    return saved
  }
}
