import type { Admin } from '../entities/Admin.js'

export interface AuthRepository {
  findByEmail(email: string): Promise<{ admin: Admin; passwordHash: string } | null>
}
