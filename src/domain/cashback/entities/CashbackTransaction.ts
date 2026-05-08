export interface CashbackTransaction {
  id: string
  passId: string
  purchaseAmount: number
  cashbackPercent: number
  cashbackAmount: number
  description: string | null
  createdAt: string
}
