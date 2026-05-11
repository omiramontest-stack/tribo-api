import type { PrismaClient } from '@prisma/client'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../../../domain/auth/entities/Admin.js'

export class AuthPrismaRepository implements AuthRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findByEmail(email: string): Promise<{ admin: Admin; passwordHash: string | null } | null> {
    const row = await this._db.admin.findUnique({ where: { email } })
    if (!row) return null
    return { admin: { id: row.id, email: row.email, emailVerified: row.emailVerified }, passwordHash: row.passwordHash }
  }

  async findByGoogleId(googleId: string): Promise<Admin | null> {
    const row = await this._db.admin.findUnique({ where: { googleId } })
    if (!row) return null
    return { id: row.id, email: row.email, emailVerified: row.emailVerified }
  }

  async findById(id: string): Promise<Admin | null> {
    const row = await this._db.admin.findUnique({ where: { id } })
    if (!row) return null
    return { id: row.id, email: row.email, emailVerified: row.emailVerified }
  }

  async create(data: { email: string; passwordHash?: string; googleId?: string; emailVerified?: boolean }): Promise<Admin> {
    const row = await this._db.admin.create({ data: { ...data, emailVerified: data.emailVerified ?? false } })
    return { id: row.id, email: row.email, emailVerified: row.emailVerified }
  }

  async setVerificationToken(adminId: string, token: string, expiresAt: Date): Promise<void> {
    await this._db.admin.update({
      where: { id: adminId },
      data: { emailVerificationToken: token, emailVerificationTokenExpiresAt: expiresAt },
    })
  }

  async verifyEmail(token: string): Promise<Admin | null> {
    const row = await this._db.admin.findUnique({ where: { emailVerificationToken: token } })
    if (!row) return null
    if (!row.emailVerificationTokenExpiresAt || row.emailVerificationTokenExpiresAt < new Date()) return null

    const updated = await this._db.admin.update({
      where: { id: row.id },
      data: { emailVerified: true, emailVerificationToken: null, emailVerificationTokenExpiresAt: null },
    })
    return { id: updated.id, email: updated.email, emailVerified: updated.emailVerified }
  }
}
