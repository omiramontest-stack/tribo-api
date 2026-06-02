import { randomUUID } from 'crypto'
import type { SessionCodeRepository } from '../../../domain/auth/repository/SessionCodeRepository.js'

export interface CreateSessionCodeDto {
  adminId: string
}

export class CreateSessionCodeUseCase {
  constructor(private readonly _sessionCodeRepo: SessionCodeRepository) {}

  async run(dto: CreateSessionCodeDto): Promise<string> {
    const code = {
      id: randomUUID(),
      adminId: dto.adminId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }
    await this._sessionCodeRepo.save(code)
    return code.id
  }
}
