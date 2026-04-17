import type { PassData } from './PassData.js'

export interface Pass {
  id: string
  walletId: string
  token: string
  customerName: string
  data: PassData
  createdAt: string
}
