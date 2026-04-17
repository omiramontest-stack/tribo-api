import type { PrismaClient } from '@prisma/client'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { Wallet, WalletType } from '../../../domain/wallet/entities/Wallet.js'
import type { WalletRules } from '../../../domain/wallet/entities/WalletRules.js'

export class WalletPrismaRepository implements WalletRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findAll(): Promise<Wallet[]> {
    const rows = await this._db.wallet.findMany({ orderBy: { createdAt: 'desc' } })
    return rows.map(this._toEntity)
  }

  async findById(id: string): Promise<Wallet | null> {
    const row = await this._db.wallet.findUnique({ where: { id } })
    return row ? this._toEntity(row) : null
  }

  async save(wallet: Wallet): Promise<Wallet> {
    const row = await this._db.wallet.create({
      data: {
        id: wallet.id,
        type: wallet.type,
        businessName: wallet.businessName,
        logoUrl: wallet.logoUrl,
        primaryColor: wallet.primaryColor,
        accentColor: wallet.accentColor,
        description: wallet.description,
        rules: wallet.rules as object,
      },
    })
    return this._toEntity(row)
  }

  async delete(id: string): Promise<void> {
    await this._db.wallet.delete({ where: { id } })
  }

  private _toEntity(row: {
    id: string
    type: string
    businessName: string
    logoUrl: string | null
    primaryColor: string
    accentColor: string
    description: string
    rules: unknown
    createdAt: Date
  }): Wallet {
    return {
      id: row.id,
      type: row.type as WalletType,
      businessName: row.businessName,
      logoUrl: row.logoUrl,
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      description: row.description,
      rules: row.rules as WalletRules,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
