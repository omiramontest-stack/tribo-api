import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import type { UpdatePassDataDto } from '../dto/UpdatePassDataDto.js'
import type { PassWithWallet } from './GetPassByTokenUseCase.js'
import type { StampsRules, PointsRules, MembershipRules } from '../../../domain/wallet/entities/WalletRules.js'
import { AppError } from '../../common/AppError.js'

export class UpdatePassDataUseCase implements UseCase<UpdatePassDataDto, PassWithWallet> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _passRepository: PassRepository,
  ) {}

  async run(dto: UpdatePassDataDto): Promise<PassWithWallet> {
    const pass = await this._passRepository.findByToken(dto.token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (dto.action === 'add_stamp' && pass.data.type === 'stamps') {
      const rules = wallet.rules as StampsRules
      pass.data = { ...pass.data, currentStamps: Math.min(pass.data.currentStamps + 1, rules.totalStamps) }
    } else if (dto.action === 'add_points' && pass.data.type === 'points') {
      pass.data = { ...pass.data, currentPoints: pass.data.currentPoints + (dto.amount ?? 1) }
    } else if (dto.action === 'renew_membership' && pass.data.type === 'membership') {
      const rules = wallet.rules as MembershipRules
      const expiresAt = rules.expiresInDays
        ? new Date(Date.now() + rules.expiresInDays * 86400000).toISOString()
        : null
      pass.data = { ...pass.data, expiresAt }
    } else {
      throw new AppError('ACTION_MISMATCH', 'Action does not match pass type', 400)
    }

    const updated = await this._passRepository.update(pass)
    return { pass: updated, wallet }
  }
}
