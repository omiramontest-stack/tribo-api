import type { SessionCodeRepository } from '../../../domain/auth/repository/SessionCodeRepository.js'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../../../domain/auth/entities/Admin.js'
import { AppError } from '../../common/AppError.js'

export interface ExchangeSessionCodeDto {
  code: string
}

export class ExchangeSessionCodeUseCase {
  constructor(
    private readonly _sessionCodeRepo: SessionCodeRepository,
    private readonly _authRepo: AuthRepository,
  ) {}

  async run(dto: ExchangeSessionCodeDto): Promise<Admin> {
    const sessionCode = await this._sessionCodeRepo.consume(dto.code)
    if (!sessionCode) throw new AppError('INVALID_SESSION_CODE', 'Invalid or expired session code', 401)

    const admin = await this._authRepo.findById(sessionCode.adminId)
    if (!admin) throw new AppError('NOT_FOUND', 'Admin not found', 404)

    return admin
  }
}
