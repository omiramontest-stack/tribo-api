import { randomUUID } from 'crypto'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { sendVerificationEmail } from '../../../infrastructure/email/EmailService.js'

export interface SendVerificationEmailDto {
  adminId: string
  email: string
}

export class SendVerificationEmailUseCase implements UseCase<SendVerificationEmailDto, void> {
  constructor(private readonly _authRepository: AuthRepository) {}

  async run(dto: SendVerificationEmailDto): Promise<void> {
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await this._authRepository.setVerificationToken(dto.adminId, token, expiresAt)

    const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:5173').split(',')[0].trim()
    const verifyUrl = `${clientUrl}/verify-email?token=${token}`

    await sendVerificationEmail({ to: dto.email, verifyUrl })
  }
}
