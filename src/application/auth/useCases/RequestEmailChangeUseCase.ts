import { randomUUID } from 'crypto'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'
import { sendEmailChangeConfirmation } from '../../../infrastructure/email/EmailService.js'

export interface RequestEmailChangeDto {
  adminId: string
  newEmail: string
}

export class RequestEmailChangeUseCase implements UseCase<RequestEmailChangeDto, void> {
  constructor(private readonly _authRepository: AuthRepository) {}

  async run(dto: RequestEmailChangeDto): Promise<void> {
    const existing = await this._authRepository.findByEmail(dto.newEmail)
    if (existing) throw new AppError('EMAIL_ALREADY_IN_USE', 'Este correo ya está registrado', 409)

    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await this._authRepository.requestEmailChange(dto.adminId, dto.newEmail, token, expiresAt)

    const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:5173').split(',')[0].trim()
    const confirmUrl = `${clientUrl}/confirm-email-change?token=${token}`

    await sendEmailChangeConfirmation({ to: dto.newEmail, confirmUrl })
  }
}
