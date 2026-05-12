import bcrypt from 'bcryptjs'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface ChangePasswordDto {
  adminId: string
  currentPassword: string
  newPassword: string
}

export class ChangePasswordUseCase implements UseCase<ChangePasswordDto, void> {
  constructor(private readonly _authRepository: AuthRepository) {}

  async run(dto: ChangePasswordDto): Promise<void> {
    const currentHash = await this._authRepository.getPasswordHash(dto.adminId)

    if (currentHash) {
      const valid = await bcrypt.compare(dto.currentPassword, currentHash)
      if (!valid) throw new AppError('INVALID_CREDENTIALS', 'La contraseña actual es incorrecta', 401)
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12)
    await this._authRepository.updatePassword(dto.adminId, newHash)
  }
}
