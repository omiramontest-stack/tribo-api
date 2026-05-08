import type { PrismaClient } from '@prisma/client'
import { PassEventType } from '@prisma/client'
import type {
  AnalyticsRepository,
  AnalyticsPeriod,
  OrgSummary,
  WalletSummary,
  DayCount,
  ActivityFeedItem,
  TopWallet,
  TopCustomer,
  WalletInsights,
  EventBreakdownItem,
} from '../../../domain/analytics/repository/AnalyticsRepository.js'

const SCAN_TYPES: PassEventType[] = ['stamp_added', 'stamp_redeemed', 'points_added', 'points_redeemed', 'cashback_added', 'cashback_redeemed', 'membership_renewed', 'daypass_scanned']
const REDEEM_TYPES: PassEventType[] = ['stamp_redeemed', 'points_redeemed', 'cashback_redeemed']
const INACTIVE_THRESHOLD_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

function periodToDays(period: AnalyticsPeriod): number {
  return { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[period]
}

function sinceDate(days: number): Date {
  return new Date(Date.now() - days * MS_PER_DAY)
}

const ACTIVE_PASS = { deletedAt: null } as const

export class AnalyticsPrismaRepository implements AnalyticsRepository {
  constructor(private readonly _db: PrismaClient) {}

  async getOrgSummary(organizationId: string, period: AnalyticsPeriod): Promise<OrgSummary> {
    const since = sinceDate(periodToDays(period))

    const [activeWallets, totalPasses, newPassesInPeriod, totalScans, totalRedemptions, activePassIds] = await Promise.all([
      this._db.wallet.count({ where: { organizationId, deletedAt: null } }),
      this._db.pass.count({ where: { wallet: { organizationId }, deletedAt: null } }),
      this._db.pass.count({ where: { wallet: { organizationId }, deletedAt: null, createdAt: { gte: since } } }),
      this._db.passEvent.count({ where: { organizationId, type: { in: SCAN_TYPES }, createdAt: { gte: since }, pass: ACTIVE_PASS } }),
      this._db.passEvent.count({ where: { organizationId, type: { in: REDEEM_TYPES }, pass: ACTIVE_PASS } }),
      this._db.passEvent.findMany({
        where: { organizationId, type: { in: SCAN_TYPES }, createdAt: { gte: since }, pass: ACTIVE_PASS },
        select: { passId: true },
        distinct: ['passId'],
      }),
    ])

    const retentionRate = totalPasses === 0 ? 0
      : Math.round((activePassIds.length / totalPasses) * 1000) / 10

    return { activeWallets, totalPasses, totalScans, totalRedemptions, retentionRate, newPassesInPeriod }
  }

  async getOrgChartByDay(organizationId: string, period: AnalyticsPeriod): Promise<DayCount[]> {
    const days = periodToDays(period)
    const since = sinceDate(days)

    const events = await this._db.passEvent.findMany({
      where: { organizationId, type: { in: SCAN_TYPES }, createdAt: { gte: since }, pass: ACTIVE_PASS },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const map = new Map<string, number>()
    for (let i = days - 1; i >= 0; i--) {
      map.set(new Date(Date.now() - i * MS_PER_DAY).toISOString().slice(0, 10), 0)
    }
    for (const e of events) {
      const key = e.createdAt.toISOString().slice(0, 10)
      map.set(key, (map.get(key) ?? 0) + 1)
    }

    return Array.from(map.entries()).map(([date, count]) => ({ date, count }))
  }

  async getOrgActivityFeed(organizationId: string, limit: number): Promise<ActivityFeedItem[]> {
    const events = await this._db.passEvent.findMany({
      where: { organizationId, pass: ACTIVE_PASS },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        pass: {
          select: { firstName: true, lastName: true, wallet: { select: { businessName: true } } },
        },
      },
    })

    return events.map((e) => ({
      type: e.type,
      passFirstName: e.pass.firstName,
      passLastName: e.pass.lastName,
      walletName: e.pass.wallet.businessName,
      createdAt: e.createdAt.toISOString(),
    }))
  }

  async getOrgTopWallets(organizationId: string, period: AnalyticsPeriod): Promise<TopWallet[]> {
    const days = periodToDays(period)
    const since = sinceDate(days)
    const since7d = sinceDate(7)
    const since14d = sinceDate(14)

    const [wallets, activeCountsByWallet, periodCounts, counts7d, counts14to7] = await Promise.all([
      this._db.wallet.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, businessName: true, type: true },
      }),
      this._db.pass.groupBy({
        by: ['walletId'],
        where: { wallet: { organizationId }, deletedAt: null },
        _count: true,
      }),
      this._db.passEvent.groupBy({
        by: ['walletId'],
        where: { organizationId, type: { in: SCAN_TYPES }, createdAt: { gte: since }, pass: ACTIVE_PASS },
        _count: true,
      }),
      this._db.passEvent.groupBy({
        by: ['walletId'],
        where: { organizationId, type: { in: SCAN_TYPES }, createdAt: { gte: since7d }, pass: ACTIVE_PASS },
        _count: true,
      }),
      this._db.passEvent.groupBy({
        by: ['walletId'],
        where: { organizationId, type: { in: SCAN_TYPES }, createdAt: { gte: since14d, lt: since7d }, pass: ACTIVE_PASS },
        _count: true,
      }),
    ])

    const toMap = (rows: { walletId: string; _count: number }[]) =>
      new Map(rows.map(r => [r.walletId, r._count]))

    const activeMap = new Map(activeCountsByWallet.map(r => [r.walletId, r._count]))
    const periodMap = toMap(periodCounts)
    const map7d = toMap(counts7d)
    const map14to7 = toMap(counts14to7)

    return wallets
      .map((w) => {
        const activeCount = activeMap.get(w.id) ?? 0
        const totalScans = periodMap.get(w.id) ?? 0
        const scans7d = map7d.get(w.id) ?? 0
        const scansLast14to7 = map14to7.get(w.id) ?? 0
        const delta7d = scansLast14to7 === 0 ? 0 : Math.round(((scans7d - scansLast14to7) / scansLast14to7) * 1000) / 10
        return { walletId: w.id, walletName: w.businessName, walletType: w.type, activeCount, totalScans, delta7d }
      })
      .sort((a, b) => b.totalScans - a.totalScans)
  }

  async getOrgEventBreakdown(organizationId: string, period: AnalyticsPeriod): Promise<EventBreakdownItem[]> {
    const since = sinceDate(periodToDays(period))

    const rows = await this._db.passEvent.groupBy({
      by: ['type'],
      where: { organizationId, createdAt: { gte: since }, pass: ACTIVE_PASS },
      _count: true,
      orderBy: { _count: { type: 'desc' } },
    })

    const total = rows.reduce((sum, r) => sum + r._count, 0)
    return rows.map(r => ({
      type: r.type,
      count: r._count,
      percent: total === 0 ? 0 : Math.round((r._count / total) * 1000) / 10,
    }))
  }

  async getWalletSummary(walletId: string, _organizationId: string): Promise<WalletSummary> {
    const since30d = sinceDate(INACTIVE_THRESHOLD_DAYS)

    const [totalIssued, activeCount, totalScans, totalRedemptions, redeemingPassIds, recentPassIds] = await Promise.all([
      this._db.pass.count({ where: { walletId } }),
      this._db.pass.count({ where: { walletId, deletedAt: null } }),
      this._db.passEvent.count({ where: { walletId, type: { in: SCAN_TYPES }, pass: ACTIVE_PASS } }),
      this._db.passEvent.count({ where: { walletId, type: { in: REDEEM_TYPES }, pass: ACTIVE_PASS } }),
      this._db.passEvent.findMany({
        where: { walletId, type: { in: REDEEM_TYPES }, pass: ACTIVE_PASS },
        select: { passId: true },
        distinct: ['passId'],
      }),
      this._db.passEvent.findMany({
        where: { walletId, type: { in: SCAN_TYPES }, createdAt: { gte: since30d }, pass: ACTIVE_PASS },
        select: { passId: true },
        distinct: ['passId'],
      }),
    ])

    // % de pases activos que tuvieron al menos un canje
    const redemptionRate = activeCount === 0 ? 0
      : Math.round((redeemingPassIds.length / activeCount) * 1000) / 10

    const inactiveCount = Math.max(0, activeCount - recentPassIds.length)

    return { totalIssued, activeCount, totalScans, totalRedemptions, redemptionRate, inactiveCount }
  }

  async getWalletChartByDay(walletId: string, days: number): Promise<DayCount[]> {
    const since = sinceDate(days)

    const events = await this._db.passEvent.findMany({
      where: { walletId, type: { in: SCAN_TYPES }, createdAt: { gte: since }, pass: ACTIVE_PASS },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const map = new Map<string, number>()
    for (let i = days - 1; i >= 0; i--) {
      map.set(new Date(Date.now() - i * MS_PER_DAY).toISOString().slice(0, 10), 0)
    }
    for (const e of events) {
      const key = e.createdAt.toISOString().slice(0, 10)
      map.set(key, (map.get(key) ?? 0) + 1)
    }

    return Array.from(map.entries()).map(([date, count]) => ({ date, count }))
  }

  async getWalletInsights(walletId: string): Promise<WalletInsights> {
    const events = await this._db.passEvent.findMany({
      where: { walletId, type: { in: SCAN_TYPES }, pass: ACTIVE_PASS },
      select: { createdAt: true, passId: true },
    })

    const hourMap = new Map<number, number>()
    const dayMap = new Map<number, number>()
    const passCountMap = new Map<string, number>()

    for (const e of events) {
      const h = e.createdAt.getHours()
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1)

      const d = e.createdAt.getDay()
      dayMap.set(d, (dayMap.get(d) ?? 0) + 1)

      passCountMap.set(e.passId, (passCountMap.get(e.passId) ?? 0) + 1)
    }

    let bestHour: number | null = null
    let bestHourCount = 0
    for (const [h, c] of hourMap) {
      if (c > bestHourCount) { bestHourCount = c; bestHour = h }
    }

    let bestDayOfWeek: number | null = null
    let bestDayCount = 0
    for (const [d, c] of dayMap) {
      if (c > bestDayCount) { bestDayCount = c; bestDayOfWeek = d }
    }

    const sortedPasses = Array.from(passCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    let topCustomers: TopCustomer[] = []
    if (sortedPasses.length > 0) {
      const topPassIds = sortedPasses.map(([id]) => id)
      const passes = await this._db.pass.findMany({
        where: { id: { in: topPassIds }, deletedAt: null },
        select: { id: true, firstName: true, lastName: true },
      })
      const passMap = new Map(passes.map(p => [p.id, p]))
      topCustomers = sortedPasses.flatMap(([passId, eventCount]) => {
        const p = passMap.get(passId)
        return p ? [{ firstName: p.firstName, lastName: p.lastName, eventCount }] : []
      })
    }

    return { bestHour, bestDayOfWeek, topCustomers }
  }
}
