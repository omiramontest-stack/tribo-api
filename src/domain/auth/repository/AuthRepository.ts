import type { Admin } from '../entities/Admin.js'

export interface AuthRepository {
  findByEmail(email: string): Promise<{ admin: Admin; passwordHash: string | null } | null>
  findByGoogleId(googleId: string): Promise<Admin | null>
  findById(id: string): Promise<Admin | null>
  create(data: { email: string; passwordHash?: string; googleId?: string; emailVerified?: boolean }): Promise<Admin>
  setVerificationToken(adminId: string, token: string, expiresAt: Date): Promise<void>
  verifyEmail(token: string): Promise<Admin | null>
  getPasswordHash(adminId: string): Promise<string | null>
  updatePassword(adminId: string, passwordHash: string): Promise<void>
  requestEmailChange(adminId: string, pendingEmail: string, token: string, expiresAt: Date): Promise<void>
  confirmEmailChange(token: string): Promise<Admin | null>
  setPasswordResetToken(adminId: string, token: string, expiresAt: Date): Promise<void>
  findByResetToken(token: string): Promise<Admin | null>
  resetPassword(token: string, passwordHash: string): Promise<Admin | null>
  getRefreshTokenHash(adminId: string): Promise<string | null>
  setRefreshTokenHash(adminId: string, hash: string | null): Promise<void>
}
