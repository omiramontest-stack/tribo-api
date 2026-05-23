/**
 * Tests — Auth flow (Fix-22 / Flow 1)
 *
 * Unit tests for LoginUseCase. The AuthRepository is mocked so no DB is needed.
 * Tests the critical security invariants:
 *   - Correct password → returns Admin
 *   - Wrong password → INVALID_CREDENTIALS error
 *   - Unknown email → INVALID_CREDENTIALS error (no user-enumeration leak)
 */
import { describe, it, expect, mock } from 'bun:test'
import bcrypt from 'bcryptjs'
import { LoginUseCase } from '../application/auth/useCases/LoginUseCase.js'
import { AppError } from '../application/common/AppError.js'
import type { AuthRepository } from '../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../domain/auth/entities/Admin.js'

const makeAdmin = (): Admin => ({
  id: 'admin-1',
  email: 'test@example.com',
  emailVerified: true,
})

function makeAuthRepo(override: Partial<AuthRepository> = {}): AuthRepository {
  return {
    findByEmail: mock(async () => null),
    findById: mock(async () => null),
    save: mock(async (a: Admin) => a),
    saveRefreshToken: mock(async () => {}),
    findRefreshToken: mock(async () => null),
    revokeRefreshToken: mock(async () => {}),
    revokeAllRefreshTokens: mock(async () => {}),
    updatePassword: mock(async () => {}),
    saveEmailVerificationToken: mock(async () => {}),
    findEmailVerificationToken: mock(async () => null),
    deleteEmailVerificationToken: mock(async () => {}),
    markEmailVerified: mock(async () => {}),
    saveEmailChangeRequest: mock(async () => {}),
    findEmailChangeRequest: mock(async () => null),
    deleteEmailChangeRequest: mock(async () => {}),
    updateEmail: mock(async () => {}),
    savePasswordResetToken: mock(async () => {}),
    findPasswordResetToken: mock(async () => null),
    deletePasswordResetToken: mock(async () => {}),
    findOrCreateByGoogle: mock(async () => makeAdmin()),
    ...override,
  } as unknown as AuthRepository
}

describe('LoginUseCase', () => {
  it('returns admin when credentials are correct', async () => {
    const admin = makeAdmin()
    const passwordHash = await bcrypt.hash('correct-password', 10)
    const repo = makeAuthRepo({
      findByEmail: mock(async () => ({ admin, passwordHash })),
    })
    const useCase = new LoginUseCase(repo)
    const result = await useCase.run({ email: 'test@example.com', password: 'correct-password' })
    expect(result.id).toBe('admin-1')
    expect(result.email).toBe('test@example.com')
    expect(result.emailVerified).toBe(true)
  })

  it('throws INVALID_CREDENTIALS for wrong password', async () => {
    const admin = makeAdmin()
    const passwordHash = await bcrypt.hash('correct-password', 10)
    const repo = makeAuthRepo({
      findByEmail: mock(async () => ({ admin, passwordHash })),
    })
    const useCase = new LoginUseCase(repo)
    await expect(useCase.run({ email: 'test@example.com', password: 'wrong-password' }))
      .rejects.toBeInstanceOf(AppError)
    await expect(useCase.run({ email: 'test@example.com', password: 'wrong-password' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 })
  })

  it('throws INVALID_CREDENTIALS (not NOT_FOUND) for unknown email — no user enumeration', async () => {
    const repo = makeAuthRepo({
      findByEmail: mock(async () => null),
    })
    const useCase = new LoginUseCase(repo)
    await expect(useCase.run({ email: 'nobody@example.com', password: 'any' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', statusCode: 401 })
  })
})
