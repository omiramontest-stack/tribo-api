export interface Geofence {
  id: string
  walletId: string
  label: string
  latitude: number
  longitude: number
  /** Metros. Apple Wallet usa ~100 m como mínimo efectivo. */
  radiusMeters: number
  message: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}
