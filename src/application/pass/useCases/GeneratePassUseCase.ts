import { randomUUID } from 'crypto'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PassData } from '../../../domain/pass/entities/PassData.js'
import type { UseCase } from '../../common/UseCase.js'
import type { GeneratePassDto } from '../dto/GeneratePassDto.js'
import type { StampsRules, MembershipRules } from '../../../domain/wallet/entities/WalletRules.js'
import { AppError } from '../../common/AppError.js'

export class GeneratePassUseCase implements UseCase<GeneratePassDto, Pass> {
  constructor(
    private readonly _walletRepository: WalletRepository,
    private readonly _passRepository: PassRepository,
  ) {}

  async run(dto: GeneratePassDto): Promise<Pass> {
    const wallet = await this._walletRepository.findById(dto.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    const now = new Date().toISOString()
    let data: PassData

    if (wallet.type === 'stamps') {
      data = { type: 'stamps', currentStamps: 0 }
    } else if (wallet.type === 'points') {
      data = { type: 'points', currentPoints: 0 }
    } else {
      const rules = wallet.rules as MembershipRules
      const expiresAt = rules.expiresInDays
        ? new Date(Date.now() + rules.expiresInDays * 86400000).toISOString()
        : null
      data = { type: 'membership', memberSince: now, expiresAt }
    }

    const pass: Pass = {
      id: randomUUID(),
      walletId: dto.walletId,
      token: randomUUID(),
      customerName: dto.customerName,
      data,
      createdAt: now,
    }

    return this._passRepository.save(pass)
  }
}
