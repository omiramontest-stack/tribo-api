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

  async getPasswordHash(adminId: string): Promise<string | null> {
    const row = await this._db.admin.findUnique({ where: { id: adminId } })
    return row?.passwordHash ?? null
  }

  async updatePassword(adminId: string, passwordHash: string): Promise<void> {
    await this._db.admin.update({ where: { id: adminId }, data: { passwordHash } })
  }

  async requestEmailChange(adminId: string, pendingEmail: string, token: string, expiresAt: Date): Promise<void> {
    await this._db.admin.update({
      where: { id: adminId },
      data: { pendingEmail, pendingEmailToken: token, pendingEmailTokenExpiresAt: expiresAt },
    })
  }

  async confirmEmailChange(token: string): Promise<Admin | null> {
    const row = await this._db.admin.findUnique({ where: { pendingEmailToken: token } })
    if (!row || !row.pendingEmail) return null
    if (!row.pendingEmailTokenExpiresAt || row.pendingEmailTokenExpiresAt < new Date()) return null

    const updated = await this._db.admin.update({
      where: { id: row.id },
      data: {
        email: row.pendingEmail,
        emailVerified: true,
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailTokenExpiresAt: null,
      },
    })
    return { id: updated.id, email: updated.email, emailVerified: updated.emailVerified }
  }

  async getRefreshTokenHash(adminId: string): Promise<string | null> {
    const row = await this._db.admin.findUnique({ where: { id: adminId }, select: { refreshTokenHash: true } })
    return row?.refreshTokenHash ?? null
  }

  async setRefreshTokenHash(adminId: string, hash: string | null): Promise<void> {
    await this._db.admin.update({ where: { id: adminId }, data: { refreshTokenHash: hash } })
  }

  async setPasswordResetToken(adminId: string, token: string, expiresAt: Date): Promise<void> {
    await this._db.admin.update({
      where: { id: adminId },
      data: { passwordResetToken: token, passwordResetTokenExpiresAt: expiresAt },
    })
  }

  async findByResetToken(token: string): Promise<Admin | null> {
    const row = await this._db.admin.findUnique({ where: { passwordResetToken: token } })
    if (!row) return null
    if (!row.passwordResetTokenExpiresAt || row.passwordResetTokenExpiresAt < new Date()) return null
    return { id: row.id, email: row.email, emailVerified: row.emailVerified }
  }

  async resetPassword(token: string, passwordHash: string): Promise<Admin | null> {
    const row = await this._db.admin.findUnique({ where: { passwordResetToken: token } })
    if (!row) return null
    if (!row.passwordResetTokenExpiresAt || row.passwordResetTokenExpiresAt < new Date()) return null

    const updated = await this._db.admin.update({
      where: { id: row.id },
      data: { passwordHash, passwordResetToken: null, passwordResetTokenExpiresAt: null },
    })
    return { id: updated.id, email: updated.email, emailVerified: updated.emailVerified }
  }
}
