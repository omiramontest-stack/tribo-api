import type { PassDownloadTokenRepository } from '../../../domain/pass/repository/PassDownloadTokenRepository.js'
import { AppError } from '../../common/AppError.js'

export class RedeemDownloadTokenUseCase {
  constructor(private readonly _tokenRepository: PassDownloadTokenRepository) {}

  async run(token: string): Promise<{ passToken: string }> {
    const record = await this._tokenRepository.findByToken(token)
    if (!record) throw new AppError('TOKEN_NOT_FOUND', 'Link inválido', 404)

    if (new Date(record.expiresAt) < new Date())
      throw new AppError('TOKEN_EXPIRED', 'El link ha expirado', 410)

    if (record.usedAt)
      throw new AppError('TOKEN_USED', 'El link ya fue utilizado', 410)

    await this._tokenRepository.markUsed(record.id)

    return { passToken: record.passToken }
  }
}
