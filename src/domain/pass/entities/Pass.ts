import type { PassData } from './PassData.js'

export type PassStatus = 'active' | 'completed' | 'archived'

export interface Pass {
  id: string
  walletId: string
  token: string
  /** Token secreto para el protocolo Apple PassKit Web Service. */
  authToken: string
  firstName: string
  lastName: string
  phone: string
  email: string | null
  data: PassData
  status: PassStatus
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
