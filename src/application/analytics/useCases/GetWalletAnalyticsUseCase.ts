import type { AnalyticsRepository } from '../../../domain/analytics/repository/AnalyticsRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import { AppError } from '../../common/AppError.js'

export interface GetWalletAnalyticsDto {
  walletId: string
  organizationId: string
  adminId: string
  days: number
}

export class GetWalletAnalyticsUseCase {
  constructor(
    private readonly _analyticsRepository: AnalyticsRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: GetWalletAnalyticsDto) {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const wallet = await this._walletRepository.findById(dto.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const [summary, chartByDay, insights] = await Promise.all([
      this._analyticsRepository.getWalletSummary(dto.walletId, dto.organizationId),
      this._analyticsRepository.getWalletChartByDay(dto.walletId, dto.days),
      this._analyticsRepository.getWalletInsights(dto.walletId),
    ])

    return { summary, chartByDay, insights }
  }
}
