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
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { Wallet } from '../../../domain/wallet/entities/Wallet.js'
import type { PassData, StampsData, MembershipData, PointsData, CashbackData, BundleData, GiftCardData, CouponData } from '../../../domain/pass/entities/PassData.js'
import type { StampsRules, MembershipRules, PointsRules, CashbackRules, BundleRules, GiftCardRules, CouponRules } from '../../../domain/wallet/entities/WalletRules.js'
import { AppError } from '../../common/AppError.js'
import { sendPassUpdateNotification, sendCampaignNotification } from '../../../infrastructure/apple/ApnsService.js'
import { updateGoogleWalletObject } from '../../../infrastructure/google/GoogleWalletService.js'
import type { PassEventType } from '../../../domain/analytics/entities/PassEvent.js'

function roundCents(value: number): number {
  return Math.round(value * 100) / 100
}

type ActionResult = {
  updatedData: PassData
  eventType: PassEventType
  eventMetadata: Record<string, unknown>
  notificationTitle: string
  notificationBody: string
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

    await this.validateAccess(wallet, dto)

    const result = await this.resolveAction(pass, wallet, dto)
    pass.data = result.updatedData

    const updated = await this._passRepository.update(pass)
    await this.dispatchUpdates(updated, wallet, dto, result)

    return { pass: updated, wallet }
  }

  private async validateAccess(wallet: Wallet, dto: UpdatePassDataDto): Promise<void> {
    if (wallet.organizationId !== dto.organizationId)
      throw new AppError('FORBIDDEN', 'This pass does not belong to your organization', 403)

    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember)
      throw new AppError('FORBIDDEN', 'This pass does not belong to your organization', 403)
  }

  private async resolveAction(pass: Pass, wallet: Wallet, dto: UpdatePassDataDto): Promise<ActionResult> {
    const { action } = dto
    const data = pass.data

    if (action === 'add_stamp' && data.type === 'stamps')
      return this.applyAddStamp(data, wallet.rules as StampsRules, wallet.businessName)

    if (action === 'add_points' && data.type === 'points')
      return this.applyAddPoints(data, wallet.rules as PointsRules, wallet.businessName, dto.amount ?? 1)

    if (action === 'renew_membership' && data.type === 'membership')
      return this.applyRenewMembership(data, wallet.rules as MembershipRules, wallet.businessName)

    if (action === 'add_cashback' && data.type === 'cashback') {
      if (!dto.purchaseAmount || dto.purchaseAmount <= 0)
        throw new AppError('INVALID_INPUT', 'purchaseAmount is required and must be positive', 400)
      return this.applyAddCashback(data, wallet.rules as CashbackRules, wallet.businessName, pass.id, dto.purchaseAmount, dto.cashbackPercent, dto.description)
    }

    if (action === 'subtract_cashback' && data.type === 'cashback') {
      if (!dto.amount || dto.amount <= 0)
        throw new AppError('INVALID_INPUT', 'amount is required and must be positive', 400)
      return this.applySubtractCashback(data, wallet.rules as CashbackRules, wallet.businessName, pass.id, dto.amount, dto.description)
    }

    if (action === 'use_bundle' && data.type === 'bundle')
      return this.applyUseBundle(data, wallet.rules as BundleRules, wallet.businessName)

    if (action === 'add_giftcard' && data.type === 'giftcard') {
      if (!dto.amount || dto.amount <= 0)
        throw new AppError('INVALID_INPUT', 'amount is required and must be positive', 400)
      return this.applyAddGiftcard(data, wallet.rules as GiftCardRules, wallet.businessName, dto.amount)
    }

    if (action === 'subtract_giftcard' && data.type === 'giftcard') {
      if (!dto.amount || dto.amount <= 0)
        throw new AppError('INVALID_INPUT', 'amount is required and must be positive', 400)
      return this.applySubtractGiftcard(data, wallet.rules as GiftCardRules, wallet.businessName, dto.amount)
    }

    if (action === 'redeem_coupon' && data.type === 'coupon')
      return this.applyRedeemCoupon(data, wallet.rules as CouponRules, wallet.businessName)

    throw new AppError('ACTION_MISMATCH', 'Action does not match pass type', 400)
  }

  private async dispatchUpdates(
    pass: Pass,
    wallet: Wallet,
    dto: UpdatePassDataDto,
    result: ActionResult,
  ): Promise<void> {
    const registrations = await this._db.deviceRegistration.findMany({
      where: { passToken: pass.token },
      select: { pushToken: true },
    })
    const pushTokens = registrations.map((r: { pushToken: string }) => r.pushToken)

    await Promise.allSettled([
      sendPassUpdateNotification(pushTokens),
      result.notificationTitle
        ? sendCampaignNotification(pushTokens, result.notificationTitle, result.notificationBody)
        : Promise.resolve(),
      updateGoogleWalletObject(wallet, pass),
      this._passEventRepository.save({
        id: randomUUID(),
        organizationId: dto.organizationId,
        walletId: pass.walletId,
        passId: pass.id,
        type: result.eventType,
        metadata: result.eventMetadata,
        createdBy: dto.adminId,
        createdAt: new Date().toISOString(),
      }),
    ])
  }

  private applyAddStamp(data: StampsData, rules: StampsRules, businessName: string): ActionResult {
    const newStamps = Math.min(data.currentStamps + 1, rules.totalStamps)
    const isComplete = newStamps >= rules.totalStamps
    return {
      updatedData: { ...data, currentStamps: newStamps },
      eventType: isComplete ? 'stamp_redeemed' : 'stamp_added',
      eventMetadata: { currentStamps: newStamps, totalStamps: rules.totalStamps },
      notificationTitle: `¡Nuevo sello en ${businessName}!`,
      notificationBody: isComplete
        ? `¡Completaste tus ${rules.totalStamps} sellos! Reclama tu recompensa`
        : `Tienes ${newStamps}/${rules.totalStamps} sellos`,
    }
  }

  private applyAddPoints(data: PointsData, rules: PointsRules, businessName: string, amount: number): ActionResult {
    const newPoints = data.currentPoints + amount
    return {
      updatedData: { ...data, currentPoints: newPoints },
      eventType: 'points_added',
      eventMetadata: { amount, currentPoints: newPoints },
      notificationTitle: `¡+${amount} ${rules.pointsLabel} en ${businessName}!`,
      notificationBody: `Total: ${newPoints} ${rules.pointsLabel}`,
    }
  }

  private applyRenewMembership(data: MembershipData, rules: MembershipRules, businessName: string): ActionResult {
    const expiresAt = rules.expiresInDays
      ? new Date(Date.now() + rules.expiresInDays * 86400000).toISOString()
      : null
    return {
      updatedData: { ...data, expiresAt },
      eventType: 'membership_renewed',
      eventMetadata: { expiresAt },
      notificationTitle: `¡Membresía renovada en ${businessName}!`,
      notificationBody: `Válida hasta ${expiresAt ? new Date(expiresAt).toLocaleDateString('es-MX') : 'sin vencimiento'}`,
    }
  }

  private async applyAddCashback(
    data: CashbackData,
    rules: CashbackRules,
    businessName: string,
    passId: string,
    purchaseAmount: number,
    cashbackPercent?: number,
    description?: string | null,
  ): Promise<ActionResult> {
    const percent = cashbackPercent ?? rules.cashbackPercent
    const cashbackAmount = roundCents(purchaseAmount * percent / 100)
    const newBalance = roundCents(data.balance + cashbackAmount)

    await this._cashbackTransactionRepository.save({
      id: randomUUID(),
      passId,
      purchaseAmount,
      cashbackPercent: percent,
      cashbackAmount,
      description: description ?? null,
      createdAt: new Date().toISOString(),
    })

    return {
      updatedData: { ...data, balance: newBalance },
      eventType: 'cashback_added',
      eventMetadata: { purchaseAmount, cashbackPercent: percent, cashbackAmount, balance: newBalance },
      notificationTitle: `¡+${rules.currency} ${cashbackAmount.toFixed(2)} de cashback en ${businessName}!`,
      notificationBody: `Saldo: ${rules.currency} ${newBalance.toFixed(2)}`,
    }
  }

  private async applySubtractCashback(
    data: CashbackData,
    rules: CashbackRules,
    businessName: string,
    passId: string,
    amount: number,
    description?: string | null,
  ): Promise<ActionResult> {
    if (amount > data.balance)
      throw new AppError('INSUFFICIENT_BALANCE', `Cannot redeem ${amount}, current balance is ${data.balance}`, 400)

    const redeemAmount = roundCents(amount)
    const newBalance = roundCents(data.balance - redeemAmount)

    await this._cashbackTransactionRepository.save({
      id: randomUUID(),
      passId,
      purchaseAmount: redeemAmount,
      cashbackPercent: 0,
      cashbackAmount: -redeemAmount,
      description: description ?? null,
      createdAt: new Date().toISOString(),
    })

    return {
      updatedData: { ...data, balance: newBalance },
      eventType: 'cashback_redeemed',
      eventMetadata: { amount: redeemAmount, balance: newBalance },
      notificationTitle: `¡Canjeaste ${rules.currency} ${redeemAmount.toFixed(2)} en ${businessName}!`,
      notificationBody: `Saldo restante: ${rules.currency} ${newBalance.toFixed(2)}`,
    }
  }

  private applyUseBundle(data: BundleData, rules: BundleRules, businessName: string): ActionResult {
    if (data.remainingUses <= 0)
      throw new AppError('NO_USES_LEFT', 'No remaining uses on this bundle', 400)

    const newRemaining = data.remainingUses - 1
    return {
      updatedData: { ...data, remainingUses: newRemaining },
      eventType: 'bundle_used',
      eventMetadata: { remainingUses: newRemaining },
      notificationTitle: `Usaste 1 pase en ${businessName}`,
      notificationBody: `Te quedan ${newRemaining} de ${rules.totalUses} ${rules.label}`,
    }
  }

  private applyAddGiftcard(data: GiftCardData, rules: GiftCardRules, businessName: string, amount: number): ActionResult {
    const newBalance = roundCents(data.currentBalance + amount)
    return {
      updatedData: { ...data, currentBalance: newBalance },
      eventType: 'giftcard_credited',
      eventMetadata: { amount, currentBalance: newBalance },
      notificationTitle: `¡+${rules.currency} ${amount.toFixed(2)} en tu Gift Card de ${businessName}!`,
      notificationBody: `Saldo: ${rules.currency} ${newBalance.toFixed(2)}`,
    }
  }

  private applySubtractGiftcard(data: GiftCardData, rules: GiftCardRules, businessName: string, amount: number): ActionResult {
    if (amount > data.currentBalance)
      throw new AppError('INSUFFICIENT_BALANCE', `Cannot redeem ${amount}, current balance is ${data.currentBalance}`, 400)

    const newBalance = roundCents(data.currentBalance - amount)
    return {
      updatedData: { ...data, currentBalance: newBalance },
      eventType: 'giftcard_redeemed',
      eventMetadata: { amount, currentBalance: newBalance },
      notificationTitle: `Usaste ${rules.currency} ${amount.toFixed(2)} de tu Gift Card de ${businessName}`,
      notificationBody: `Saldo: ${rules.currency} ${newBalance.toFixed(2)}`,
    }
  }

  private applyRedeemCoupon(data: CouponData, rules: CouponRules, businessName: string): ActionResult {
    if (data.used)
      throw new AppError('COUPON_ALREADY_USED', 'This coupon has already been redeemed', 400)
    if (data.expiresAt && new Date(data.expiresAt) < new Date())
      throw new AppError('COUPON_EXPIRED', 'This coupon has expired', 400)

    const discountLabel = rules.discountType === 'percent'
      ? `${rules.discount}%`
      : `${rules.currency ?? ''} ${rules.discount}`

    return {
      updatedData: { ...data, used: true },
      eventType: 'coupon_redeemed',
      eventMetadata: {},
      notificationTitle: `¡Cupón canjeado en ${businessName}!`,
      notificationBody: `Descuento de ${discountLabel} aplicado`,
    }
  }
}
