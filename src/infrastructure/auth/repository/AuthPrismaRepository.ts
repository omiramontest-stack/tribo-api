import type { PrismaClient } from '@prisma/client'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../../../domain/auth/entities/Admin.js'

export class AuthPrismaRepository implements AuthRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findByEmail(email: string): Promise<{ admin: Admin; passwordHash: string | null } | null> {
    const row = await this._db.admin.findUnique({ where: { email } })
    if (!row) return null
    return { admin: { id: row.id, email: row.email }, passwordHash: row.passwordHash }
  }

  async findByGoogleId(googleId: string): Promise<Admin | null> {
    const row = await this._db.admin.findUnique({ where: { googleId } })
    if (!row) return null
    return { id: row.id, email: row.email }
  }

  async create(data: { email: string; passwordHash?: string; googleId?: string }): Promise<Admin> {
    const row = await this._db.admin.create({ data })
    return { id: row.id, email: row.email }
  }
}
