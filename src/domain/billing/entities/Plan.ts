export type PlanSlug = 'trial' | 'base' | 'pro'
export type AnalyticsLevel = 'none' | 'basic' | 'full'

export interface Plan {
  id: string
  slug: PlanSlug
  name: string
  price: number
  currency: string
  stripePriceId: string | null
  maxWallets: number
  maxPasses: number | null
  emailCampaigns: boolean
  smsCampaigns: boolean
  analyticsLevel: AnalyticsLevel
  isActive: boolean
  createdAt: string
  updatedAt: string
}
