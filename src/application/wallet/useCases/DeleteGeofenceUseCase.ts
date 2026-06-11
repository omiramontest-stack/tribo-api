import type { GeofenceRepository } from '../../../domain/wallet/repository/GeofenceRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'
import { sendPassUpdateNotification } from '../../../infrastructure/apple/ApnsService.js'
import { updateGoogleWalletClass } from '../../../infrastructure/google/GoogleWalletService.js'

export interface DeleteGeofenceDto {
  id: string
  organizationId: string
  adminId: string
}

export class DeleteGeofenceUseCase implements UseCase<DeleteGeofenceDto, void> {
  constructor(
    private readonly _geofenceRepository: GeofenceRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _passRepository: PassRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: DeleteGeofenceDto): Promise<void> {
    const role = await this._orgRepository.getMemberRole(dto.adminId, dto.organizationId)
    if (!role || role === 'staff') throw new AppError('FORBIDDEN', 'Only owners and admins can manage geofences', 403)

    const geofence = await this._geofenceRepository.findById(dto.id)
    if (!geofence) throw new AppError('GEOFENCE_NOT_FOUND', 'Geofence not found', 404)

    const wallet = await this._walletRepository.findById(geofence.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    await this._geofenceRepository.delete(dto.id)

    const [allGeofences] = await Promise.all([
      this._geofenceRepository.findActiveByWalletId(geofence.walletId),
    ])

    this._propagateToDevices(geofence.walletId, { wallet, geofences: allGeofences }).catch(() => {})
  }

  private async _propagateToDevices(
    walletId: string,
    google: { wallet: import('../../../domain/wallet/entities/Wallet.js').Wallet; geofences: import('../../../domain/wallet/entities/Geofence.js').Geofence[] },
  ): Promise<void> {
    await this._passRepository.touchAllByWalletId(walletId)

    const [pushTokens] = await Promise.all([
      this._passRepository.findAllPushTokensByWalletId(walletId),
      updateGoogleWalletClass(google.wallet, google.geofences),
    ])

    if (pushTokens.length > 0) await sendPassUpdateNotification(pushTokens)
  }
}
