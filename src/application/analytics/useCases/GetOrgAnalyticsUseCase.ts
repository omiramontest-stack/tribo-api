import type { AnalyticsRepository, AnalyticsPeriod } from '../../../domain/analytics/repository/AnalyticsRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import { AppError } from '../../common/AppError.js'

export interface GetOrgAnalyticsDto {
  organizationId: string
  adminId: string
  period: AnalyticsPeriod
}

export class GetOrgAnalyticsUseCase {
  constructor(
    private readonly _analyticsRepository: AnalyticsRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: GetOrgAnalyticsDto) {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const [summary, chartByDay, recentActivity, topWallets, eventBreakdown] = await Promise.all([
      this._analyticsRepository.getOrgSummary(dto.organizationId, dto.period),
      this._analyticsRepository.getOrgChartByDay(dto.organizationId, dto.period),
      this._analyticsRepository.getOrgActivityFeed(dto.organizationId, 20),
      this._analyticsRepository.getOrgTopWallets(dto.organizationId, dto.period),
      this._analyticsRepository.getOrgEventBreakdown(dto.organizationId, dto.period),
    ])

    return { summary, chartByDay, recentActivity, topWallets, eventBreakdown }
  }
}
