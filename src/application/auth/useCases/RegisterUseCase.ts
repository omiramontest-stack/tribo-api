import bcrypt from 'bcryptjs'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../../../domain/auth/entities/Admin.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface RegisterDto {
  email: string
  password: string
}

export class RegisterUseCase implements UseCase<RegisterDto, Admin> {
  constructor(private readonly _authRepository: AuthRepository) {}

  async run(dto: RegisterDto): Promise<Admin> {
    const existing = await this._authRepository.findByEmail(dto.email)
    if (existing) throw new AppError('EMAIL_TAKEN', 'Email already in use', 409)

    const passwordHash = await bcrypt.hash(dto.password, 10)
    return this._authRepository.create({ email: dto.email, passwordHash })
  }
}
