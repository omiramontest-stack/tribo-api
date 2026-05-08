export interface SmsCreditPack {
  id: string
  name: string
  price: number
  currency: string
  credits: number
  stripePriceId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}
