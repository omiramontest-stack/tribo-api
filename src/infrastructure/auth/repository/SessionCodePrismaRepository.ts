import type { PrismaClient } from '@prisma/client'
import type { SessionCodeRepository } from '../../../domain/auth/repository/SessionCodeRepository.js'
import type { SessionCode } from '../../../domain/auth/entities/SessionCode.js'

export class SessionCodePrismaRepository implements SessionCodeRepository {
  constructor(private readonly _db: PrismaClient) {}

  async save(code: SessionCode): Promise<void> {
    await this._db.sessionCode.create({
      data: {
        id: code.id,
        adminId: code.adminId,
        expiresAt: new Date(code.expiresAt),
      },
    })
  }

  async consume(id: string): Promise<SessionCode | null> {
    return this._db.$transaction(async (tx) => {
      const row = await tx.sessionCode.findFirst({
        where: { id, expiresAt: { gt: new Date() } },
      })
      if (!row) return null
      await tx.sessionCode.delete({ where: { id } })
      return { id: row.id, adminId: row.adminId, expiresAt: row.expiresAt.toISOString() }
    })
  }
}
