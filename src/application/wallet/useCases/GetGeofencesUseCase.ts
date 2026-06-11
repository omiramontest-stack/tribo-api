import type { GeofenceRepository } from '../../../domain/wallet/repository/GeofenceRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Geofence } from '../../../domain/wallet/entities/Geofence.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface GetGeofencesDto {
  walletId: string
  organizationId: string
  adminId: string
}

export class GetGeofencesUseCase implements UseCase<GetGeofencesDto, Geofence[]> {
  constructor(
    private readonly _geofenceRepository: GeofenceRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(dto: GetGeofencesDto): Promise<Geofence[]> {
    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const wallet = await this._walletRepository.findById(dto.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)
    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    return this._geofenceRepository.findAllByWalletId(dto.walletId)
  }
}
