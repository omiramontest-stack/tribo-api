import type { PassData } from './PassData.js'

export interface Pass {
  id: string
  walletId: string
  token: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
  data: PassData
  createdAt: string
  deletedAt: string | null
}
