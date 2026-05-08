import type { PrismaClient } from '@prisma/client'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { Wallet, WalletType } from '../../../domain/wallet/entities/Wallet.js'
import type { WalletRules } from '../../../domain/wallet/entities/WalletRules.js'

export class WalletPrismaRepository implements WalletRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findAll(organizationId: string): Promise<Wallet[]> {
    const rows = await this._db.wallet.findMany({ where: { organizationId, deletedAt: null }, orderBy: { createdAt: 'desc' } })
    return rows.map(r => this._toEntity(r))
  }

  async countByOrganizationId(organizationId: string): Promise<number> {
    return this._db.wallet.count({ where: { organizationId, deletedAt: null } })
  }

  async findById(id: string): Promise<Wallet | null> {
    const row = await this._db.wallet.findUnique({ where: { id, deletedAt: null } })
    return row ? this._toEntity(row) : null
  }

  async save(wallet: Wallet): Promise<Wallet> {
    const row = await this._db.wallet.create({
      data: {
        id: wallet.id,
        organizationId: wallet.organizationId,
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
    await this._db.wallet.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  private _toEntity(row: Awaited<ReturnType<typeof this._db.wallet.findUniqueOrThrow>>): Wallet {
    return {
      id: row.id,
      organizationId: row.organizationId,
      type: row.type as WalletType,
      businessName: row.businessName,
      logoUrl: row.logoUrl,
      primaryColor: row.primaryColor,
      accentColor: row.accentColor,
      description: row.description,
      rules: row.rules as unknown as WalletRules,
      createdAt: row.createdAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    }
  }
}
