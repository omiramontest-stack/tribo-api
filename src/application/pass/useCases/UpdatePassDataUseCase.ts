import { randomUUID } from 'crypto'
import type { PrismaClient } from '@prisma/client'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { CashbackTransactionRepository } from '../../../domain/cashback/repository/CashbackTransactionRepository.js'
import type { PassEventRepository } from '../../../domain/analytics/repository/PassEventRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import type { UpdatePassDataDto } from '../dto/UpdatePassDataDto.js'
import type { PassWithWallet } from './GetPassByTokenUseCase.js'
import type { MembershipRules, CashbackRules } from '../../../domain/wallet/entities/WalletRules.js'
import { AppError } from '../../common/AppError.js'
import { sendPassUpdateNotification } from '../../../infrastructure/apple/ApnsService.js'
import { updateGoogleWalletObject } from '../../../infrastructure/google/GoogleWalletService.js'
import type { PassEventType } from '../../../domain/analytics/entities/PassEvent.js'

function roundCents(value: number): number {
  return Math.round(value * 100) / 100
}

export class UpdatePassDataUseCase implements UseCase<UpdatePassDataDto, PassWithWallet> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _passRepository: PassRepository,
    private readonly _db: PrismaClient,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _cashbackTransactionRepository: CashbackTransactionRepository,
    private readonly _passEventRepository: PassEventRepository,
  ) {}

  async run(dto: UpdatePassDataDto): Promise<PassWithWallet> {
    const pass = await this._passRepository.findByToken(dto.token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'This pass does not belong to your organization', 403)

    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'This pass does not belong to your organization', 403)

    let eventType: PassEventType
    let eventMetadata: Record<string, unknown> = {}

    if (dto.action === 'add_stamp' && pass.data.type === 'stamps') {
      const rules = wallet.rules as { totalStamps: number }
      const newStamps = Math.min(pass.data.currentStamps + 1, rules.totalStamps)
      pass.data = { ...pass.data, currentStamps: newStamps }
      eventType = newStamps >= rules.totalStamps ? 'stamp_redeemed' : 'stamp_added'
      eventMetadata = { currentStamps: newStamps, totalStamps: rules.totalStamps }
    } else if (dto.action === 'add_points' && pass.data.type === 'points') {
      const amount = dto.amount ?? 1
      pass.data = { ...pass.data, currentPoints: pass.data.currentPoints + amount }
      eventType = 'points_added'
      eventMetadata = { amount, currentPoints: pass.data.currentPoints }
    } else if (dto.action === 'renew_membership' && pass.data.type === 'membership') {
      const rules = wallet.rules as MembershipRules
      const expiresAt = rules.expiresInDays
        ? new Date(Date.now() + rules.expiresInDays * 86400000).toISOString()
        : null
      pass.data = { ...pass.data, expiresAt }
      eventType = 'membership_renewed'
      eventMetadata = { expiresAt }
    } else if (dto.action === 'add_cashback' && pass.data.type === 'cashback') {
      if (!dto.purchaseAmount || dto.purchaseAmount <= 0) throw new AppError('INVALID_INPUT', 'purchaseAmount is required and must be positive', 400)

      const rules = wallet.rules as CashbackRules
      const percent = dto.cashbackPercent ?? rules.cashbackPercent
      const cashbackAmount = roundCents(dto.purchaseAmount * percent / 100)

      pass.data = { ...pass.data, balance: roundCents(pass.data.balance + cashbackAmount) }

      await this._cashbackTransactionRepository.save({
        id: randomUUID(),
        passId: pass.id,
        purchaseAmount: dto.purchaseAmount,
        cashbackPercent: percent,
        cashbackAmount,
        description: dto.description ?? null,
        createdAt: new Date().toISOString(),
      })
      eventType = 'cashback_added'
      eventMetadata = { purchaseAmount: dto.purchaseAmount, cashbackPercent: percent, cashbackAmount, balance: pass.data.balance }
    } else if (dto.action === 'subtract_cashback' && pass.data.type === 'cashback') {
      if (!dto.amount || dto.amount <= 0) throw new AppError('INVALID_INPUT', 'amount is required and must be positive', 400)
      if (dto.amount > pass.data.balance) throw new AppError('INSUFFICIENT_BALANCE', `Cannot redeem ${dto.amount}, current balance is ${pass.data.balance}`, 400)

      const redeemAmount = roundCents(dto.amount)
      pass.data = { ...pass.data, balance: roundCents(pass.data.balance - redeemAmount) }

      await this._cashbackTransactionRepository.save({
        id: randomUUID(),
        passId: pass.id,
        purchaseAmount: redeemAmount,
        cashbackPercent: 0,
        cashbackAmount: -redeemAmount,
        description: dto.description ?? null,
        createdAt: new Date().toISOString(),
      })
      eventType = 'cashback_redeemed'
      eventMetadata = { amount: redeemAmount, balance: pass.data.balance }
    } else if (dto.action === 'use_bundle' && pass.data.type === 'bundle') {
      if (pass.data.remainingUses <= 0) throw new AppError('NO_USES_LEFT', 'No remaining uses on this bundle', 400)
      pass.data = { ...pass.data, remainingUses: pass.data.remainingUses - 1 }
      eventType = 'bundle_used'
      eventMetadata = { remainingUses: pass.data.remainingUses }
    } else if (dto.action === 'add_giftcard' && pass.data.type === 'giftcard') {
      if (!dto.amount || dto.amount <= 0) throw new AppError('INVALID_INPUT', 'amount is required and must be positive', 400)
      pass.data = { ...pass.data, currentBalance: roundCents(pass.data.currentBalance + dto.amount) }
      eventType = 'giftcard_credited'
      eventMetadata = { amount: dto.amount, currentBalance: pass.data.currentBalance }
    } else if (dto.action === 'subtract_giftcard' && pass.data.type === 'giftcard') {
      if (!dto.amount || dto.amount <= 0) throw new AppError('INVALID_INPUT', 'amount is required and must be positive', 400)
      if (dto.amount > pass.data.currentBalance) throw new AppError('INSUFFICIENT_BALANCE', `Cannot redeem ${dto.amount}, current balance is ${pass.data.currentBalance}`, 400)
      pass.data = { ...pass.data, currentBalance: roundCents(pass.data.currentBalance - dto.amount) }
      eventType = 'giftcard_redeemed'
      eventMetadata = { amount: dto.amount, currentBalance: pass.data.currentBalance }
    } else if (dto.action === 'redeem_coupon' && pass.data.type === 'coupon') {
      if (pass.data.used) throw new AppError('COUPON_ALREADY_USED', 'This coupon has already been redeemed', 400)
      if (pass.data.expiresAt && new Date(pass.data.expiresAt) < new Date()) throw new AppError('COUPON_EXPIRED', 'This coupon has expired', 400)
      pass.data = { ...pass.data, used: true }
      eventType = 'coupon_redeemed'
      eventMetadata = {}
    } else {
      throw new AppError('ACTION_MISMATCH', 'Action does not match pass type', 400)
    }

    const updated = await this._passRepository.update(pass)

    const registrations = await this._db.deviceRegistration.findMany({
      where: { passToken: pass.token },
      select: { pushToken: true },
    })

    await Promise.allSettled([
      sendPassUpdateNotification(registrations.map((r: { pushToken: string }) => r.pushToken)),
      updateGoogleWalletObject(wallet, updated),
      this._passEventRepository.save({
        id: randomUUID(),
        organizationId: dto.organizationId,
        walletId: pass.walletId,
        passId: pass.id,
        type: eventType,
        metadata: eventMetadata,
        createdBy: dto.adminId,
        createdAt: new Date().toISOString(),
      }),
    ])

    return { pass: updated, wallet }
  }
}
