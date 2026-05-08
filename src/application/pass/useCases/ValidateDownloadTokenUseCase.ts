import type { PassDownloadTokenRepository } from '../../../domain/pass/repository/PassDownloadTokenRepository.js'
import { AppError } from '../../common/AppError.js'

export class ValidateDownloadTokenUseCase {
  constructor(private readonly _tokenRepository: PassDownloadTokenRepository) {}

  async run(token: string): Promise<{ passToken: string; tokenId: string; expiresAt: string }> {
    const record = await this._tokenRepository.findByToken(token)
    if (!record) throw new AppError('TOKEN_NOT_FOUND', 'Link inválido', 401)

    if (new Date(record.expiresAt) < new Date())
      throw new AppError('TOKEN_EXPIRED', 'El link ha expirado', 401)

    if (record.usedAt)
      throw new AppError('TOKEN_USED', 'El link ya fue utilizado', 401)

    return { passToken: record.passToken, tokenId: record.id, expiresAt: record.expiresAt }
  }
}
