import bcrypt from 'bcryptjs'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../../../domain/auth/entities/Admin.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface ResetPasswordDto {
  token: string
  newPassword: string
}

export class ResetPasswordUseCase implements UseCase<ResetPasswordDto, Admin> {
  constructor(private readonly _authRepository: AuthRepository) {}

  async run(dto: ResetPasswordDto): Promise<Admin> {
    const existing = await this._authRepository.findByResetToken(dto.token)
    if (!existing) throw new AppError('INVALID_OR_EXPIRED_TOKEN', 'Token inválido o expirado', 400)

    const passwordHash = await bcrypt.hash(dto.newPassword, 10)
    const admin = await this._authRepository.resetPassword(dto.token, passwordHash)
    if (!admin) throw new AppError('INVALID_OR_EXPIRED_TOKEN', 'Token inválido o expirado', 400)
    return admin
  }
}
