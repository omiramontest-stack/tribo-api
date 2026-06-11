import { randomUUID } from 'crypto'
import type { GeofenceRepository } from '../../../domain/wallet/repository/GeofenceRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { Geofence, GeofenceWindow } from '../../../domain/wallet/entities/Geofence.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'
import { sendPassUpdateNotification } from '../../../infrastructure/apple/ApnsService.js'
import { updateGoogleWalletClass } from '../../../infrastructure/google/GoogleWalletService.js'

export interface CreateGeofenceDto {
  walletId: string
  organizationId: string
  adminId: string
  label: string
  latitude: number
  longitude: number
  radiusMeters?: number
  message: string
  scheduleEnabled?: boolean
  schedule?: GeofenceWindow[]
  timezone?: string
}

export class CreateGeofenceUseCase implements UseCase<CreateGeofenceDto, Geofence> {
  constructor(
    private readonly _geofenceRepository: GeofenceRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _passRepository: PassRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: CreateGeofenceDto): Promise<Geofence> {
    const role = await this._orgRepository.getMemberRole(dto.adminId, dto.organizationId)
    if (!role || role === 'staff') throw new AppError('FORBIDDEN', 'Only owners and admins can manage geofences', 403)

    const wallet = await this._walletRepository.findById(dto.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const now = new Date().toISOString()
    const geofence: Geofence = {
      id: randomUUID(),
      walletId: dto.walletId,
      label: dto.label,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusMeters: dto.radiusMeters ?? 100,
      message: dto.message,
      isActive: true,
      scheduleEnabled: dto.scheduleEnabled ?? false,
      schedule: dto.schedule ?? [],
      timezone: dto.timezone ?? 'America/Mexico_City',
      createdAt: now,
      updatedAt: now,
    }

    const saved = await this._geofenceRepository.save(geofence)

    const [updatedWallet, allGeofences] = await Promise.all([
      this._walletRepository.findById(dto.walletId),
      this._geofenceRepository.findActiveByWalletId(dto.walletId),
    ])

    this._propagateToDevices(dto.walletId, updatedWallet ? { wallet: updatedWallet, geofences: allGeofences } : null).catch(() => {})

    return saved
  }

  private async _propagateToDevices(
    walletId: string,
    google: { wallet: import('../../../domain/wallet/entities/Wallet.js').Wallet; geofences: Geofence[] } | null,
  ): Promise<void> {
    await this._passRepository.touchAllByWalletId(walletId)

    const [pushTokens] = await Promise.all([
      this._passRepository.findAllPushTokensByWalletId(walletId),
      google ? updateGoogleWalletClass(google.wallet, google.geofences) : Promise.resolve(),
    ])

    if (pushTokens.length > 0) await sendPassUpdateNotification(pushTokens)
  }
}
