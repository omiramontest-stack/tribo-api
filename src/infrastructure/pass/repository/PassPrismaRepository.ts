import type { PrismaClient, Pass as PrismaPass } from '@prisma/client'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PassData } from '../../../domain/pass/entities/PassData.js'
import type { PaginationParams, PaginatedResult } from '../../../application/common/Pagination.js'
import { paginate, toPaginatedResult } from '../../../application/common/Pagination.js'

export class PassPrismaRepository implements PassRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findByToken(token: string): Promise<Pass | null> {
    const row = await this._db.pass.findUnique({ where: { token, deletedAt: null } })
    return row ? this._toEntity(row) : null
  }

  async countByOrganizationId(organizationId: string): Promise<number> {
    return this._db.pass.count({
      where: { wallet: { organizationId }, deletedAt: null },
    })
  }

  async findByWalletId(walletId: string, pagination: PaginationParams): Promise<PaginatedResult<Pass>> {
    const where = { walletId, deletedAt: null }
    const { skip, take } = paginate(pagination)
    const [rows, total] = await Promise.all([
      this._db.pass.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this._db.pass.count({ where }),
    ])
    return toPaginatedResult(rows.map(r => this._toEntity(r)), total, pagination)
  }

  async findScannedByWalletId(walletId: string, pagination: PaginationParams): Promise<PaginatedResult<Pass>> {
    const where = { walletId, deletedAt: { not: null } } as const
    const { skip, take } = paginate(pagination)
    const [rows, total] = await Promise.all([
      this._db.pass.findMany({ where, orderBy: { deletedAt: 'desc' }, skip, take }),
      this._db.pass.count({ where }),
    ])
    return toPaginatedResult(rows.map(r => this._toEntity(r)), total, pagination)
  }

  async save(pass: Pass): Promise<Pass> {
    const row = await this._db.pass.create({
      data: {
        id: pass.id,
        walletId: pass.walletId,
        token: pass.token,
        firstName: pass.firstName,
        lastName: pass.lastName,
        phone: pass.phone,
        email: pass.email,
        data: pass.data as object,
      },
    })
    return this._toEntity(row)
  }

  async delete(id: string): Promise<void> {
    await this._db.pass.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async deleteByWalletId(walletId: string): Promise<void> {
    await this._db.pass.updateMany({ where: { walletId, deletedAt: null }, data: { deletedAt: new Date() } })
  }

  async update(pass: Pass): Promise<Pass> {
    const row = await this._db.pass.update({
      where: { id: pass.id },
      data: { data: pass.data as object },
    })
    return this._toEntity(row)
  }

  private _toEntity(row: PrismaPass): Pass {
    return {
      id: row.id,
      walletId: row.walletId,
      token: row.token,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      email: row.email ?? null,
      data: row.data as unknown as PassData,
      createdAt: row.createdAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    }
  }
}
