import type { CashbackTransaction } from '../entities/CashbackTransaction.js'

export interface CashbackTransactionRepository {
  save(transaction: CashbackTransaction): Promise<CashbackTransaction>
  findByPassId(passId: string): Promise<CashbackTransaction[]>
}
