import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../../../domain/auth/entities/Admin.js'
import type { UseCase } from '../../common/UseCase.js'

export interface GoogleAuthDto {
  googleId: string
  email: string
  name: string
}

export class GoogleAuthUseCase implements UseCase<GoogleAuthDto, Admin> {
  constructor(private readonly _authRepository: AuthRepository) {}

  async run(dto: GoogleAuthDto): Promise<Admin> {
    const byGoogleId = await this._authRepository.findByGoogleId(dto.googleId)
    if (byGoogleId) return byGoogleId

    const byEmail = await this._authRepository.findByEmail(dto.email)
    if (byEmail) return byEmail.admin

    return this._authRepository.create({ email: dto.email, googleId: dto.googleId, emailVerified: true })
  }
}
