import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../../../domain/auth/entities/Admin.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export class VerifyEmailUseCase implements UseCase<string, Admin> {
  constructor(private readonly _authRepository: AuthRepository) {}

  async run(token: string): Promise<Admin> {
    const admin = await this._authRepository.verifyEmail(token)
    if (!admin) throw new AppError('INVALID_OR_EXPIRED_TOKEN', 'El enlace de verificación es inválido o ha expirado', 400)
    return admin
  }
}
