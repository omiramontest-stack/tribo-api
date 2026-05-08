export type AnalyticsPeriod = '7d' | '30d' | '90d' | '1y'

export interface DayCount {
  date: string
  count: number
}

export interface ActivityFeedItem {
  type: string
  passFirstName: string
  passLastName: string
  walletName: string
  createdAt: string
}

export interface TopWallet {
  walletId: string
  walletName: string
  walletType: string
  activeCount: number
  totalScans: number
  delta7d: number
}

export interface EventBreakdownItem {
  type: string
  count: number
  percent: number
}

export interface OrgSummary {
  activeWallets: number
  totalPasses: number
  totalScans: number
  totalRedemptions: number
  retentionRate: number
  newPassesInPeriod: number
}

export interface WalletSummary {
  totalIssued: number
  activeCount: number
  totalScans: number
  totalRedemptions: number
  redemptionRate: number
  inactiveCount: number
}

export interface TopCustomer {
  firstName: string
  lastName: string
  eventCount: number
}

export interface WalletInsights {
  bestHour: number | null
  bestDayOfWeek: number | null
  topCustomers: TopCustomer[]
}

export interface AnalyticsRepository {
  getOrgSummary(organizationId: string, period: AnalyticsPeriod): Promise<OrgSummary>
  getOrgChartByDay(organizationId: string, period: AnalyticsPeriod): Promise<DayCount[]>
  getOrgActivityFeed(organizationId: string, limit: number): Promise<ActivityFeedItem[]>
  getOrgTopWallets(organizationId: string, period: AnalyticsPeriod): Promise<TopWallet[]>
  getOrgEventBreakdown(organizationId: string, period: AnalyticsPeriod): Promise<EventBreakdownItem[]>
  getWalletSummary(walletId: string, organizationId: string): Promise<WalletSummary>
  getWalletChartByDay(walletId: string, days: number): Promise<DayCount[]>
  getWalletInsights(walletId: string): Promise<WalletInsights>
}
