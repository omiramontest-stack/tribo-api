import type { GeofenceRepository } from '../../../domain/wallet/repository/GeofenceRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { Geofence } from '../../../domain/wallet/entities/Geofence.js'
import { isGeofenceCurrentlyActive } from '../../../application/wallet/utils/geofenceSchedule.js'
import { sendPassUpdateNotification } from '../../apple/ApnsService.js'
import { logger } from '../../logger/logger.js'

/** Intervalo de polling en ms. Debe coincidir con la precisión mínima del horario. */
const INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

export class GeofenceWorker {
  private _timer: NodeJS.Timeout | null = null

  constructor(
    private readonly _geofenceRepo: GeofenceRepository,
    private readonly _passRepo: PassRepository,
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

    await Promise.allSettled(walletsToNotify.map(id => this._notifyWallet(id)))
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

  private async _notifyWallet(walletId: string): Promise<void> {
    await this._passRepo.touchAllByWalletId(walletId)
    const pushTokens = await this._passRepo.findAllPushTokensByWalletId(walletId)
    if (pushTokens.length > 0) await sendPassUpdateNotification(pushTokens)
    logger.info({ walletId, devices: pushTokens.length }, '[GeofenceWorker] notified')
  }
}
