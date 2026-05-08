import bcrypt from 'bcryptjs'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../../../domain/auth/entities/Admin.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface LoginDto {
  email: string
  password: string
}

export class LoginUseCase implements UseCase<LoginDto, Admin> {
  constructor(private readonly _authRepository: AuthRepository) {}

  async run(dto: LoginDto): Promise<Admin> {
    const result = await this._authRepository.findByEmail(dto.email)
    if (!result || !result.passwordHash) throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials', 401)

    const valid = await bcrypt.compare(dto.password, result.passwordHash)
    if (!valid) throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials', 401)

    return result.admin
  }
}
