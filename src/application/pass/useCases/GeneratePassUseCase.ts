import { randomUUID } from 'crypto'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { PassEventRepository } from '../../../domain/analytics/repository/PassEventRepository.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PassData } from '../../../domain/pass/entities/PassData.js'
import type { UseCase } from '../../common/UseCase.js'
import type { GeneratePassDto } from '../dto/GeneratePassDto.js'
import type { MembershipRules, BundleRules, GiftCardRules, CouponRules } from '../../../domain/wallet/entities/WalletRules.js'
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

    const type = wallet.type
    if (type === 'stamps') {
      data = { type: 'stamps', currentStamps: 0 }
    } else if (type === 'points') {
      data = { type: 'points', currentPoints: 0 }
    } else if (type === 'cashback') {
      data = { type: 'cashback', balance: 0 }
    } else if (type === 'daypass') {
      data = { type: 'daypass', used: false }
    } else if (type === 'bundle') {
      const rules = wallet.rules as BundleRules
      data = { type: 'bundle', remainingUses: rules.totalUses }
    } else if (type === 'giftcard') {
      const rules = wallet.rules as GiftCardRules
      data = { type: 'giftcard', initialBalance: rules.initialBalance, currentBalance: rules.initialBalance }
    } else if (type === 'coupon') {
      const rules = wallet.rules as CouponRules
      const expiresAt = rules.expiresInDays
        ? new Date(Date.now() + rules.expiresInDays * 86400000).toISOString()
        : null
      data = { type: 'coupon', used: false, expiresAt }
    } else {
      const rules = wallet.rules as MembershipRules
      const expiresAt = rules.expiresInDays
        ? new Date(Date.now() + rules.expiresInDays * 86400000).toISOString()
        : null
      data = { type: 'membership', memberSince: now, expiresAt, photoUrl: dto.photoUrl ?? null }
    }

    const pass: Pass = {
      id: randomUUID(),
      walletId: dto.walletId,
      token: randomUUID(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email ?? null,
      data,
      createdAt: now,
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
