import { randomUUID } from 'crypto'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { sendPasswordResetEmail } from '../../../infrastructure/email/EmailService.js'

export interface RequestPasswordResetDto {
  email: string
}

export class RequestPasswordResetUseCase implements UseCase<RequestPasswordResetDto, void> {
  constructor(private readonly _authRepository: AuthRepository) {}

  async run(dto: RequestPasswordResetDto): Promise<void> {
    const result = await this._authRepository.findByEmail(dto.email)
    if (!result) return // no revelar si el email existe

    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await this._authRepository.setPasswordResetToken(result.admin.id, token, expiresAt)

    const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:5173').split(',')[0].trim()
    const resetUrl = `${clientUrl}/reset-password?token=${token}`

    await sendPasswordResetEmail({ to: dto.email, resetUrl })
  }
}
