import type { PassDownloadToken } from '../entities/PassDownloadToken.js'

export interface PassDownloadTokenRepository {
  findByToken(token: string): Promise<PassDownloadToken | null>
  save(token: PassDownloadToken): Promise<void>
  markUsed(id: string): Promise<void>
  invalidatePending(passId: string): Promise<void>
}
