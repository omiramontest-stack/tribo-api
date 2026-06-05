import type { PrismaClient, Pass as PrismaPass } from '@prisma/client'
import type { PassRepository, PassFilters } from '../../../domain/pass/repository/PassRepository.js'
import type { Pass, PassStatus } from '../../../domain/pass/entities/Pass.js'
import type { PassData } from '../../../domain/pass/entities/PassData.js'
import type { PaginationParams, PaginatedResult } from '../../../application/common/Pagination.js'
import { paginate, toPaginatedResult } from '../../../application/common/Pagination.js'

export class PassPrismaRepository implements PassRepository {
  constructor(private readonly _db: PrismaClient) {}

  async findByToken(token: string): Promise<Pass | null> {
    const row = await this._db.pass.findUnique({ where: { token, deletedAt: null } })
    return row ? this._toEntity(row) : null
  }

  async findByTokenAndAuthToken(token: string, authToken: string): Promise<Pass | null> {
    const row = await this._db.pass.findUnique({ where: { token, deletedAt: null } })
    if (!row || row.authToken !== authToken) return null
    return this._toEntity(row)
  }

  async countByOrganizationId(organizationId: string): Promise<number> {
    return this._db.pass.count({
      where: { wallet: { organizationId }, deletedAt: null },
    })
  }

  async findByWalletId(walletId: string, pagination: PaginationParams, filters?: PassFilters): Promise<PaginatedResult<Pass>> {
    const search = filters?.search?.trim()
    const ilike = (value: string) => ({ contains: value, mode: 'insensitive' as const })
    const where = {
      walletId,
      deletedAt: null,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(search ? {
        OR: [
          { firstName: ilike(search) },
          { lastName:  ilike(search) },
          { phone:     ilike(search) },
        ],
      } : {}),
    }
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
        authToken: pass.authToken,
        firstName: pass.firstName,
        lastName: pass.lastName,
        phone: pass.phone,
        email: pass.email,
        data: pass.data as object,
        status: pass.status,
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
      data: { data: pass.data as object, status: pass.status },
    })
    return this._toEntity(row)
  }

  async findPushTokensByPassToken(passToken: string): Promise<string[]> {
    const rows = await this._db.deviceRegistration.findMany({
      where: { passToken },
      select: { pushToken: true },
    })
    return rows.map(r => r.pushToken)
  }

  async findPushTokensByPassTokens(passTokens: string[]): Promise<Map<string, string>> {
    const rows = await this._db.deviceRegistration.findMany({
      where: { passToken: { in: passTokens } },
      select: { passToken: true, pushToken: true },
    })
    const map = new Map<string, string>()
    for (const r of rows) {
      map.set(r.passToken, r.pushToken)
    }
    return map
  }

  async findAllByWalletId(walletId: string): Promise<Pass[]> {
    const rows = await this._db.pass.findMany({ where: { walletId, deletedAt: null } })
    return rows.map(r => this._toEntity(r))
  }

  async findAllPushTokensByWalletId(walletId: string): Promise<string[]> {
    // Obtiene todos los Apple push tokens de todos los passes activos de la wallet en una sola query.
    const passes = await this._db.pass.findMany({
      where: { walletId, deletedAt: null },
      select: { token: true },
    })
    const passTokens = passes.map(p => p.token)
    if (!passTokens.length) return []

    const rows = await this._db.deviceRegistration.findMany({
      where: { passToken: { in: passTokens } },
      select: { pushToken: true },
    })
    return rows.map(r => r.pushToken)
  }

  async touchAllByWalletId(walletId: string): Promise<void> {
    await this._db.pass.updateMany({
      where: { walletId, deletedAt: null },
      data: { updatedAt: new Date() },
    })
  }

  private _toEntity(row: PrismaPass): Pass {
    return {
      id: row.id,
      walletId: row.walletId,
      token: row.token,
      authToken: row.authToken,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      email: row.email ?? null,
      data: row.data as unknown as PassData,
      status: row.status as PassStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    }
  }
}
