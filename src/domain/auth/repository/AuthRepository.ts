import type { Admin } from '../entities/Admin.js'

export interface AuthRepository {
  findByEmail(email: string): Promise<{ admin: Admin; passwordHash: string | null } | null>
  findByGoogleId(googleId: string): Promise<Admin | null>
  create(data: { email: string; passwordHash?: string; googleId?: string }): Promise<Admin>
}
