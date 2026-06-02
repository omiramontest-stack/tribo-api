import type { SessionCode } from '../entities/SessionCode.js'

export interface SessionCodeRepository {
  save(code: SessionCode): Promise<void>
  consume(id: string): Promise<SessionCode | null>
}
