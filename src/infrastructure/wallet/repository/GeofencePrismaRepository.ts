import type { PrismaClient } from '@prisma/client'
import type { GeofenceRepository } from '../../../domain/wallet/repository/GeofenceRepository.js'
import type { Geofence, GeofenceWindow } from '../../../domain/wallet/entities/Geofence.js'

type GeofenceRow = Awaited<ReturnType<PrismaClient['geofence']['findUniqueOrThrow']>>

export class GeofencePrismaRepository implements GeofenceRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findAllByWalletId(walletId: string): Promise<Geofence[]> {
    const rows = await this._db.geofence.findMany({
      where: { walletId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(this._toEntity)
  }

  async findActiveByWalletId(walletId: string): Promise<Geofence[]> {
    const rows = await this._db.geofence.findMany({
      where: { walletId, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(this._toEntity)
  }

  async findAllScheduled(): Promise<Geofence[]> {
    const rows = await this._db.geofence.findMany({
      where: { scheduleEnabled: true, isActive: true },
    })
    return rows.map(this._toEntity)
  }

  async countByWalletId(walletId: string): Promise<number> {
    return this._db.geofence.count({ where: { walletId } })
  }

  async findById(id: string): Promise<Geofence | null> {
    const row = await this._db.geofence.findUnique({ where: { id } })
    return row ? this._toEntity(row) : null
  }

  async save(geofence: Geofence): Promise<Geofence> {
    const row = await this._db.geofence.create({
      data: {
        id: geofence.id,
        walletId: geofence.walletId,
        label: geofence.label,
        latitude: geofence.latitude,
        longitude: geofence.longitude,
        radiusMeters: geofence.radiusMeters,
        message: geofence.message,
        isActive: geofence.isActive,
        scheduleEnabled: geofence.scheduleEnabled,
        schedule: geofence.schedule as object[],
        timezone: geofence.timezone,
      },
    })
    return this._toEntity(row)
  }

  async update(geofence: Geofence): Promise<Geofence> {
    const row = await this._db.geofence.update({
      where: { id: geofence.id },
      data: {
        label: geofence.label,
        latitude: geofence.latitude,
        longitude: geofence.longitude,
        radiusMeters: geofence.radiusMeters,
        message: geofence.message,
        isActive: geofence.isActive,
        scheduleEnabled: geofence.scheduleEnabled,
        schedule: geofence.schedule as object[],
        timezone: geofence.timezone,
      },
    })
    return this._toEntity(row)
  }

  async delete(id: string): Promise<void> {
    await this._db.geofence.delete({ where: { id } })
  }

  private _toEntity(row: GeofenceRow): Geofence {
    return {
      id: row.id,
      walletId: row.walletId,
      label: row.label,
      latitude: row.latitude,
      longitude: row.longitude,
      radiusMeters: row.radiusMeters,
      message: row.message,
      isActive: row.isActive,
      scheduleEnabled: row.scheduleEnabled,
      schedule: (row.schedule as unknown as GeofenceWindow[]) ?? [],
      timezone: row.timezone,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
