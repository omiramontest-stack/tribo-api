import { randomUUID } from 'crypto'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { PassEventRepository } from '../../../domain/analytics/repository/PassEventRepository.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PassData } from '../../../domain/pass/entities/PassData.js'
import type { UseCase } from '../../common/UseCase.js'
import type { GeneratePassDto } from '../dto/GeneratePassDto.js'
import type { MembershipRules, StampsRules, PointsRules, CashbackRules, BundleRules, GiftCardRules, CouponRules } from '../../../domain/wallet/entities/WalletRules.js'
import { AppError } from '../../common/AppError.js'

export class GeneratePassUseCase implements UseCase<GeneratePassDto, Pass> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _passRepository: PassRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _passEventRepository: PassEventRepository,
  ) {}

  async run(dto: GeneratePassDto): Promise<Pass> {
    const wallet = await this._walletRepository.findById(dto.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const now = new Date().toISOString()
    let data: PassData

    function calcExpiry(days: number | null): string | null {
      return days ? new Date(Date.now() + days * 86400000).toISOString() : null
    }

    const type = wallet.type
    if (type === 'stamps') {
      const rules = wallet.rules as StampsRules
      data = { type: 'stamps', currentStamps: 0, expiresAt: calcExpiry(rules.expiresInDays) }
    } else if (type === 'points') {
      const rules = wallet.rules as PointsRules
      data = { type: 'points', currentPoints: 0, expiresAt: calcExpiry(rules.expiresInDays) }
    } else if (type === 'cashback') {
      const rules = wallet.rules as CashbackRules
      data = { type: 'cashback', balance: 0, expiresAt: calcExpiry(rules.expiresInDays) }
    } else if (type === 'daypass') {
      data = { type: 'daypass', used: false }
    } else if (type === 'bundle') {
      const rules = wallet.rules as BundleRules
      data = { type: 'bundle', remainingUses: rules.totalUses, expiresAt: calcExpiry(rules.expiresInDays) }
    } else if (type === 'giftcard') {
      const rules = wallet.rules as GiftCardRules
      data = { type: 'giftcard', initialBalance: rules.initialBalance, currentBalance: rules.initialBalance, expiresAt: calcExpiry(rules.expiresInDays) }
    } else if (type === 'coupon') {
      const rules = wallet.rules as CouponRules
      data = { type: 'coupon', used: false, expiresAt: calcExpiry(rules.expiresInDays) }
    } else {
      const rules = wallet.rules as MembershipRules
      data = { type: 'membership', memberSince: now, expiresAt: calcExpiry(rules.expiresInDays), photoUrl: dto.photoUrl ?? null }
    }

    const pass: Pass = {
      id: randomUUID(),
      walletId: dto.walletId,
      token: randomUUID(),
      authToken: randomUUID(), // Token para el protocolo Apple PassKit Web Service
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email ?? null,
      data,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    const saved = await this._passRepository.save(pass)

    await this._passEventRepository.save({
      id: randomUUID(),
      organizationId: dto.organizationId,
      walletId: dto.walletId,
      passId: saved.id,
      type: 'pass_created',
      metadata: { passType: wallet.type },
      createdBy: dto.adminId,
      createdAt: now,
    })

    return saved
  }
}
