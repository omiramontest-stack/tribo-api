import type { PrismaClient } from '@prisma/client'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../../../domain/auth/entities/Admin.js'

export class AuthPrismaRepository implements AuthRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findByEmail(email: string): Promise<{ admin: Admin; passwordHash: string } | null> {
    const row = await this._db.admin.findUnique({ where: { email } })
    if (!row) return null
    return {
      admin: { id: row.id, email: row.email, businessName: row.businessName },
      passwordHash: row.passwordHash,
    }
  }
}
