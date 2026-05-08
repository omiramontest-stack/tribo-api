import type { PrismaClient } from '@prisma/client'
import type { CashbackTransactionRepository } from '../../../domain/cashback/repository/CashbackTransactionRepository.js'
import type { CashbackTransaction } from '../../../domain/cashback/entities/CashbackTransaction.js'

export class CashbackTransactionPrismaRepository implements CashbackTransactionRepository {
  constructor(private readonly _db: PrismaClient) {}

  async save(transaction: CashbackTransaction): Promise<CashbackTransaction> {
    const row = await this._db.cashbackTransaction.create({
      data: {
        id: transaction.id,
        passId: transaction.passId,
        purchaseAmount: transaction.purchaseAmount,
        cashbackPercent: transaction.cashbackPercent,
        cashbackAmount: transaction.cashbackAmount,
        description: transaction.description,
        createdAt: new Date(transaction.createdAt),
      },
    })
    return this._map(row)
  }

  async findByPassId(passId: string): Promise<CashbackTransaction[]> {
    const rows = await this._db.cashbackTransaction.findMany({
      where: { passId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(this._map)
  }

  private _map(row: {
    id: string
    passId: string
    purchaseAmount: number
    cashbackPercent: number
    cashbackAmount: number
    description: string | null
    createdAt: Date
  }): CashbackTransaction {
    return {
      id: row.id,
      passId: row.passId,
      purchaseAmount: row.purchaseAmount,
      cashbackPercent: row.cashbackPercent,
      cashbackAmount: row.cashbackAmount,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
