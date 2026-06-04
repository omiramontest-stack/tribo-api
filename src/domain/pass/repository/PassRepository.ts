import type { Pass } from '../entities/Pass.js'
import type { PaginationParams, PaginatedResult } from '../../../application/common/Pagination.js'

export interface PassFilters {
  search?: string
}

export interface PassRepository {
  findByToken(token: string): Promise<Pass | null>
  /** Busca un pass activo verificando que el authToken coincida (para Apple PassKit Web Service). */
  findByTokenAndAuthToken(token: string, authToken: string): Promise<Pass | null>
  countByOrganizationId(organizationId: string): Promise<number>
  findByWalletId(walletId: string, pagination: PaginationParams, filters?: PassFilters): Promise<PaginatedResult<Pass>>
  findScannedByWalletId(walletId: string, pagination: PaginationParams): Promise<PaginatedResult<Pass>>
  save(pass: Pass): Promise<Pass>
  update(pass: Pass): Promise<Pass>
  delete(id: string): Promise<void>
  deleteByWalletId(walletId: string): Promise<void>
  /** Devuelve los push tokens de los dispositivos Apple registrados para un pass (por passToken). */
  findPushTokensByPassToken(passToken: string): Promise<string[]>
  /** Batch: devuelve un mapa passToken → pushToken para un conjunto de passes. */
  findPushTokensByPassTokens(passTokens: string[]): Promise<Map<string, string>>
  /** Devuelve todos los passes activos de una wallet (sin paginación, para operaciones masivas). */
  findAllByWalletId(walletId: string): Promise<Pass[]>
  /** Devuelve todos los Apple push tokens registrados para cualquier pass de una wallet. */
  findAllPushTokensByWalletId(walletId: string): Promise<string[]>
  /** Actualiza updatedAt de todos los passes activos de una wallet para que Apple los descargue en el próximo ciclo de actualización. */
  touchAllByWalletId(walletId: string): Promise<void>
}
