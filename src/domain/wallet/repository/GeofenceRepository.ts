import type { Geofence } from '../entities/Geofence.js'

export interface GeofenceRepository {
  findAllByWalletId(walletId: string): Promise<Geofence[]>
  /** Geofences con isActive=true. El caller aplica el filtro de horario. */
  findActiveByWalletId(walletId: string): Promise<Geofence[]>
  /** Geofences con scheduleEnabled=true e isActive=true — usadas por el worker. */
  findAllScheduled(): Promise<Geofence[]>
  countByWalletId(walletId: string): Promise<number>
  findById(id: string): Promise<Geofence | null>
  save(geofence: Geofence): Promise<Geofence>
  update(geofence: Geofence): Promise<Geofence>
  delete(id: string): Promise<void>
}
