import type { Geofence } from '../entities/Geofence.js'

export interface GeofenceRepository {
  findAllByWalletId(walletId: string): Promise<Geofence[]>
  findActiveByWalletId(walletId: string): Promise<Geofence[]>
  countByWalletId(walletId: string): Promise<number>
  findById(id: string): Promise<Geofence | null>
  save(geofence: Geofence): Promise<Geofence>
  update(geofence: Geofence): Promise<Geofence>
  delete(id: string): Promise<void>
}
