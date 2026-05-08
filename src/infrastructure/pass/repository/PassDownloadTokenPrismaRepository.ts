import type { PrismaClient } from '@prisma/client'
import type { PassDownloadTokenRepository } from '../../../domain/pass/repository/PassDownloadTokenRepository.js'
import type { PassDownloadToken } from '../../../domain/pass/entities/PassDownloadToken.js'

export class PassDownloadTokenPrismaRepository implements PassDownloadTokenRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findByToken(token: string): Promise<PassDownloadToken | null> {
    const row = await this._db.passDownloadToken.findUnique({ where: { token } })
    return row ? this._toEntity(row) : null
  }

  async save(token: PassDownloadToken): Promise<void> {
    await this._db.passDownloadToken.create({
      data: {
        id: token.id,
        passId: token.passId,
        passToken: token.passToken,
        token: token.token,
        expiresAt: new Date(token.expiresAt),
      },
    })
  }

  async markUsed(id: string): Promise<void> {
    await this._db.passDownloadToken.update({ where: { id }, data: { usedAt: new Date() } })
  }

  async invalidatePending(passId: string): Promise<void> {
    await this._db.passDownloadToken.updateMany({
      where: { passId, usedAt: null },
      data: { usedAt: new Date() },
    })
  }

  private _toEntity(row: {
    id: string
    passId: string
    passToken: string
    token: string
    expiresAt: Date
    usedAt: Date | null
    createdAt: Date
  }): PassDownloadToken {
    return {
      id: row.id,
      passId: row.passId,
      passToken: row.passToken,
      token: row.token,
      expiresAt: row.expiresAt.toISOString(),
      usedAt: row.usedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
