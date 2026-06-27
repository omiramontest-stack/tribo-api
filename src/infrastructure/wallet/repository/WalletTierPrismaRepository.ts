import { type PrismaClient, Prisma } from '@prisma/client'
import type { WalletTierRepository } from '../../../domain/wallet/repository/WalletTierRepository.js'
import type { WalletTier, UpgradeRule } from '../../../domain/wallet/entities/WalletTier.js'
import type { WalletRules } from '../../../domain/wallet/entities/WalletRules.js'
import type { WalletThemeOverrides } from '../../../domain/wallet/entities/WalletTheme.js'

type WalletTierRow = Awaited<ReturnType<PrismaClient['walletTier']['findUniqueOrThrow']>>

export class WalletTierPrismaRepository implements WalletTierRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findByWalletId(walletId: string): Promise<WalletTier[]> {
    const rows = await this._db.walletTier.findMany({
      where: { walletId, deletedAt: null },
      orderBy: { level: 'asc' },
    })
    return rows.map(this._toEntity)
  }

  async existsForOrganization(organizationId: string): Promise<boolean> {
    const count = await this._db.walletTier.count({
      where: { deletedAt: null, wallet: { organizationId } },
    })
    return count > 0
  }

  async findById(id: string): Promise<WalletTier | null> {
    const row = await this._db.walletTier.findUnique({ where: { id } })
    return row && row.deletedAt === null ? this._toEntity(row) : null
  }

  async save(tier: WalletTier): Promise<WalletTier> {
    const row = await this._db.walletTier.create({
      data: {
        id: tier.id,
        walletId: tier.walletId,
        level: tier.level,
        name: tier.name,
        rules: tier.rules as object,
        config: (tier.config ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        unlockRule: tier.unlockRule as object,
      },
    })
    return this._toEntity(row)
  }

  async update(tier: WalletTier): Promise<WalletTier> {
    const row = await this._db.walletTier.update({
      where: { id: tier.id },
      data: {
        name: tier.name,
        rules: tier.rules as object,
        config: (tier.config ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        unlockRule: tier.unlockRule as object,
      },
    })
    return this._toEntity(row)
  }

  async delete(id: string): Promise<void> {
    await this._db.walletTier.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  private _toEntity(row: WalletTierRow): WalletTier {
    return {
      id: row.id,
      walletId: row.walletId,
      level: row.level,
      name: row.name,
      rules: row.rules as unknown as WalletRules,
      config: (row.config as WalletThemeOverrides | null) ?? null,
      unlockRule: row.unlockRule as unknown as UpgradeRule,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    }
  }
}
