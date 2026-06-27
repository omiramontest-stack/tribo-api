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
  phone: string
  firstName: string
  lastName: string
  eventCount: number
  completions: number
}

export interface WalletInsights {
  bestHour: number | null
  bestDayOfWeek: number | null
  topCustomers: TopCustomer[]
}

/** Pases activos actualmente en cada nivel (snapshot). */
export interface TierDistributionItem {
  level: number
  activeCount: number
}

/** Pases distintos que evolucionaron hacia cada nivel (≥2) — funnel de conversión. */
export interface TierFunnelItem {
  level: number
  reachedCount: number
}

/** Escaneos y redenciones acumulados ocurridos en cada nivel. */
export interface TierEngagementItem {
  level: number
  scans: number
  redemptions: number
}

export interface WalletTierBreakdown {
  distribution: TierDistributionItem[]
  funnel: TierFunnelItem[]
  engagement: TierEngagementItem[]
}

/** Resumen de tiers agregado a nivel organización — KPIs de lealtad. */
export interface OrgTierSummary {
  /** Pases distintos que han evolucionado de nivel al menos una vez. */
  upgradedPasses: number
  /** Upgrades ocurridos dentro del periodo. */
  upgradesInPeriod: number
  /** Pases activos por nivel, agregados a través de todas las wallets. */
  distribution: TierDistributionItem[]
}

export interface AnalyticsRepository {
  getOrgSummary(organizationId: string, period: AnalyticsPeriod): Promise<OrgSummary>
  getOrgChartByDay(organizationId: string, period: AnalyticsPeriod): Promise<DayCount[]>
  getOrgActivityFeed(organizationId: string, limit: number): Promise<ActivityFeedItem[]>
  getOrgTopWallets(organizationId: string, period: AnalyticsPeriod): Promise<TopWallet[]>
  getOrgEventBreakdown(organizationId: string, period: AnalyticsPeriod): Promise<EventBreakdownItem[]>
  /** Resumen de tiers de la org. Solo relevante si hay upgrades configurados. */
  getOrgTierSummary(organizationId: string, period: AnalyticsPeriod): Promise<OrgTierSummary>
  getWalletSummary(walletId: string, organizationId: string): Promise<WalletSummary>
  getWalletChartByDay(walletId: string, days: number): Promise<DayCount[]>
  getWalletInsights(walletId: string): Promise<WalletInsights>
  /** Métricas por nivel (tier). Solo relevante para wallets con upgrades configurados. */
  getWalletTierBreakdown(walletId: string): Promise<WalletTierBreakdown>
}
