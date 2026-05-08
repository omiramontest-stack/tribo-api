import type { PrismaClient } from '@prisma/client'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { PassData } from '../../../domain/pass/entities/PassData.js'
import type { Segment } from '../../../domain/campaign/entities/Segment.js'

type RawPass = {
  id: string; walletId: string; token: string; firstName: string
  lastName: string; phone: string; email: string | null; data: unknown; createdAt: Date
  deletedAt: Date | null
}

function toPass(r: RawPass): Pass {
  return {
    id: r.id, walletId: r.walletId, token: r.token,
    firstName: r.firstName, lastName: r.lastName, phone: r.phone,
    email: r.email ?? null,
    data: r.data as PassData,
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt?.toISOString() ?? null,
  }
}

export class SegmentResolverService {
  constructor(private readonly _db: PrismaClient) {}

  async resolve(segment: Segment, organizationId: string): Promise<Pass[]> {
    switch (segment.type) {
      case 'all_org': {
        const rows = await this._db.$queryRaw<RawPass[]>`
          SELECT p.* FROM "Pass" p
          JOIN "Wallet" w ON p."walletId" = w.id
          WHERE w."organizationId" = ${organizationId} AND p."deletedAt" IS NULL`
        return rows.map(toPass)
      }

      case 'all_wallet': {
        const rows = await this._db.$queryRaw<RawPass[]>`
          SELECT * FROM "Pass"
          WHERE "walletId" = ${segment.walletId} AND "deletedAt" IS NULL`
        return rows.map(toPass)
      }

      case 'near_completion': {
        const threshold = segment.thresholdPercent / 100
        const rows = await this._db.$queryRaw<RawPass[]>`
          SELECT p.* FROM "Pass" p
          JOIN "Wallet" w ON p."walletId" = w.id
          WHERE p."walletId" = ${segment.walletId}
          AND w."type" = 'stamps'
          AND p."deletedAt" IS NULL
          AND (p.data->>'currentStamps')::int >= FLOOR((w.rules->>'totalStamps')::int * ${threshold})`
        return rows.map(toPass)
      }

      case 'inactive': {
        const cutoff = new Date(Date.now() - segment.inactiveDays * 86400000)
        if (segment.walletId) {
          const rows = await this._db.$queryRaw<RawPass[]>`
            SELECT p.* FROM "Pass" p
            WHERE p."walletId" = ${segment.walletId}
            AND p."deletedAt" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "PassEvent" e
              WHERE e."passId" = p.id AND e."createdAt" > ${cutoff}
            )`
          return rows.map(toPass)
        }
        const rows = await this._db.$queryRaw<RawPass[]>`
          SELECT p.* FROM "Pass" p
          JOIN "Wallet" w ON p."walletId" = w.id
          WHERE w."organizationId" = ${organizationId}
          AND p."deletedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "PassEvent" e
            WHERE e."passId" = p.id AND e."createdAt" > ${cutoff}
          )`
        return rows.map(toPass)
      }

      case 'never_redeemed': {
        const redeemTypes = ['stamp_redeemed', 'points_redeemed', 'cashback_redeemed']
        if (segment.walletId) {
          const rows = await this._db.$queryRaw<RawPass[]>`
            SELECT p.* FROM "Pass" p
            WHERE p."walletId" = ${segment.walletId}
            AND p."deletedAt" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM "PassEvent" e
              WHERE e."passId" = p.id AND e."type" = ANY(${redeemTypes})
            )`
          return rows.map(toPass)
        }
        const rows = await this._db.$queryRaw<RawPass[]>`
          SELECT p.* FROM "Pass" p
          JOIN "Wallet" w ON p."walletId" = w.id
          WHERE w."organizationId" = ${organizationId}
          AND p."deletedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "PassEvent" e
            WHERE e."passId" = p.id AND e."type" = ANY(${redeemTypes})
          )`
        return rows.map(toPass)
      }

      case 'cashback_balance_gte': {
        const rows = await this._db.$queryRaw<RawPass[]>`
          SELECT * FROM "Pass"
          WHERE "walletId" = ${segment.walletId}
          AND "deletedAt" IS NULL
          AND (data->>'balance')::float >= ${segment.minBalance}`
        return rows.map(toPass)
      }

      case 'frequent_visitors':
        return this._resolveFrequentVisitors(segment, organizationId)

      case 'new_customers': {
        const cutoff = new Date(Date.now() - segment.withinDays * 86400000)
        if (segment.walletId) {
          const rows = await this._db.$queryRaw<RawPass[]>`
            SELECT * FROM "Pass"
            WHERE "walletId" = ${segment.walletId}
            AND "deletedAt" IS NULL AND "createdAt" >= ${cutoff}`
          return rows.map(toPass)
        }
        const rows = await this._db.$queryRaw<RawPass[]>`
          SELECT p.* FROM "Pass" p
          JOIN "Wallet" w ON p."walletId" = w.id
          WHERE w."organizationId" = ${organizationId}
          AND p."deletedAt" IS NULL AND p."createdAt" >= ${cutoff}`
        return rows.map(toPass)
      }
    }
  }

  private async _resolveFrequentVisitors(
    segment: Extract<Segment, { type: 'frequent_visitors' }>,
    organizationId: string,
  ): Promise<Pass[]> {
    const cutoff = segment.withinDays ? new Date(Date.now() - segment.withinDays * 86400000) : null
    const minEvents = segment.minEvents

    let rows: RawPass[]
    if (segment.walletId) {
      if (cutoff) {
        rows = await this._db.$queryRaw<RawPass[]>`
          SELECT p.* FROM "Pass" p
          WHERE p."walletId" = ${segment.walletId} AND p."deletedAt" IS NULL
          AND (SELECT COUNT(*) FROM "PassEvent" e WHERE e."passId" = p.id AND e."createdAt" > ${cutoff}) >= ${minEvents}`
      } else {
        rows = await this._db.$queryRaw<RawPass[]>`
          SELECT p.* FROM "Pass" p
          WHERE p."walletId" = ${segment.walletId} AND p."deletedAt" IS NULL
          AND (SELECT COUNT(*) FROM "PassEvent" e WHERE e."passId" = p.id) >= ${minEvents}`
      }
    } else if (cutoff) {
      rows = await this._db.$queryRaw<RawPass[]>`
        SELECT p.* FROM "Pass" p JOIN "Wallet" w ON p."walletId" = w.id
        WHERE w."organizationId" = ${organizationId} AND p."deletedAt" IS NULL
        AND (SELECT COUNT(*) FROM "PassEvent" e WHERE e."passId" = p.id AND e."createdAt" > ${cutoff}) >= ${minEvents}`
    } else {
      rows = await this._db.$queryRaw<RawPass[]>`
        SELECT p.* FROM "Pass" p JOIN "Wallet" w ON p."walletId" = w.id
        WHERE w."organizationId" = ${organizationId} AND p."deletedAt" IS NULL
        AND (SELECT COUNT(*) FROM "PassEvent" e WHERE e."passId" = p.id) >= ${minEvents}`
    }
    return rows.map(toPass)
  }
}
