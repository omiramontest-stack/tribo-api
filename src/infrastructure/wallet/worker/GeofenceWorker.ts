import type { GeofenceRepository } from '../../../domain/wallet/repository/GeofenceRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { Geofence } from '../../../domain/wallet/entities/Geofence.js'
import type { PrismaClient } from '@prisma/client'
import { isGeofenceCurrentlyActive } from '../../../application/wallet/utils/geofenceSchedule.js'
import { sendPassUpdateNotification } from '../../apple/ApnsService.js'
import { updateGoogleWalletClass } from '../../google/GoogleWalletService.js'
import { logger } from '../../logger/logger.js'

/** Intervalo de polling en ms. Debe coincidir con la precisión mínima del horario. */
const INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

export class GeofenceWorker {
  private _timer: NodeJS.Timeout | null = null

  constructor(
    private readonly _geofenceRepo: GeofenceRepository,
    private readonly _walletRepo: WalletRepository,
    private readonly _passRepo: PassRepository,
    private readonly _db: PrismaClient,
  ) {}

  start(): void {
    this._timer = setInterval(() => {
      this._tick().catch(err => logger.error({ err }, '[GeofenceWorker] tick error'))
    }, INTERVAL_MS)
    logger.info('[GeofenceWorker] started')
  }

  stop(): void {
    if (this._timer) clearInterval(this._timer)
    logger.info('[GeofenceWorker] stopped')
  }

  /** Detecta wallets cuyos geofences cambiaron de estado en los últimos INTERVAL_MS
   *  y les envía un silent push para que los dispositivos descarguen el pase actualizado. */
  private async _tick(): Promise<void> {
    const [{ acquired }] = await this._db.$queryRaw<[{ acquired: boolean }]>`
      SELECT pg_try_advisory_lock(hashtext('geofence_worker')) AS acquired
    `
    if (!acquired) return

    const now = new Date()
    const before = new Date(now.getTime() - INTERVAL_MS)

    const scheduled = await this._geofenceRepo.findAllScheduled()
    if (!scheduled.length) return

    const byWallet = this._groupByWallet(scheduled)
    const walletsToNotify: string[] = []

    for (const [walletId, geofences] of byWallet) {
      if (this._stateChanged(geofences, before, now)) {
        walletsToNotify.push(walletId)
      }
    }

    if (!walletsToNotify.length) return

    logger.info({ count: walletsToNotify.length }, '[GeofenceWorker] schedule transitions detected, propagating')

    await Promise.allSettled(walletsToNotify.map(id => this._notifyWallet(id, byWallet.get(id)!, now)))
  }

  private _stateChanged(geofences: Geofence[], before: Date, now: Date): boolean {
    return geofences.some(g =>
      isGeofenceCurrentlyActive(g, before) !== isGeofenceCurrentlyActive(g, now),
    )
  }

  private _groupByWallet(geofences: Geofence[]): Map<string, Geofence[]> {
    return geofences.reduce((map, g) => {
      const list = map.get(g.walletId) ?? []
      list.push(g)
      map.set(g.walletId, list)
      return map
    }, new Map<string, Geofence[]>())
  }

  private async _notifyWallet(walletId: string, geofences: Geofence[], now: Date): Promise<void> {
    const activeNow = geofences.filter(g => isGeofenceCurrentlyActive(g, now))

    await this._passRepo.touchAllByWalletId(walletId)

    const [pushTokens, wallet] = await Promise.all([
      this._passRepo.findAllPushTokensByWalletId(walletId),
      this._walletRepo.findById(walletId),
    ])

    await Promise.allSettled([
      pushTokens.length > 0 ? sendPassUpdateNotification(pushTokens) : Promise.resolve(),
      wallet ? updateGoogleWalletClass(wallet, activeNow) : Promise.resolve(),
    ])

    logger.info({ walletId, devices: pushTokens.length, googleLocations: activeNow.length }, '[GeofenceWorker] notified')
  }
}
