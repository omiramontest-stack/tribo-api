import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { CashbackTransactionRepository } from '../../../domain/cashback/repository/CashbackTransactionRepository.js'
import type { CashbackTransaction } from '../../../domain/cashback/entities/CashbackTransaction.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface GetCashbackTransactionsDto {
  token: string
  adminId: string
  organizationId: string
}

export class GetCashbackTransactionsUseCase implements UseCase<GetCashbackTransactionsDto, CashbackTransaction[]> {
  constructor(
    private readonly _passRepository: PassRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _cashbackTransactionRepository: CashbackTransactionRepository,
  ) {}

  async run(dto: GetCashbackTransactionsDto): Promise<CashbackTransaction[]> {
    const pass = await this._passRepository.findByToken(dto.token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    if (wallet.type !== 'cashback') throw new AppError('INVALID_WALLET_TYPE', 'This wallet is not a cashback wallet', 400)

    return this._cashbackTransactionRepository.findByPassId(pass.id)
  }
}
