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
  geofencesPerWallet: number
  /** White-label: oculta el sello "Hecho con TriboWallet" en los pases. */
  removeBranding: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}
