import type { PrismaClient } from '@prisma/client'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PassData } from '../../../domain/pass/entities/PassData.js'

export class PassPrismaRepository implements PassRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findByToken(token: string): Promise<Pass | null> {
    const row = await this._db.pass.findUnique({ where: { token } })
    return row ? this._toEntity(row) : null
  }

  async findByWalletId(walletId: string): Promise<Pass[]> {
    const rows = await this._db.pass.findMany({ where: { walletId }, orderBy: { createdAt: 'desc' } })
    return rows.map(this._toEntity)
  }

  async save(pass: Pass): Promise<Pass> {
    const row = await this._db.pass.create({
      data: {
        id: pass.id,
        walletId: pass.walletId,
        token: pass.token,
        customerName: pass.customerName,
        data: pass.data as object,
      },
    })
    return this._toEntity(row)
  }

  async update(pass: Pass): Promise<Pass> {
    const row = await this._db.pass.update({
      where: { id: pass.id },
      data: { data: pass.data as object },
    })
    return this._toEntity(row)
  }

  private _toEntity(row: {
    id: string
    walletId: string
    token: string
    customerName: string
    data: unknown
    createdAt: Date
  }): Pass {
    return {
      id: row.id,
      walletId: row.walletId,
      token: row.token,
      customerName: row.customerName,
      data: row.data as PassData,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
