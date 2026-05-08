export interface CampaignDelivery {
  sent: number
  failed: number
  skipped: number
}

export interface CampaignStats {
  delivery: CampaignDelivery
  conversions: number
  conversionRate: number
  avgHoursToConvert: number | null
  windowDays: number
}
