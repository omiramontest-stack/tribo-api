import { type PrismaClient, Prisma } from '@prisma/client'
import type { PassEventRepository } from '../../../domain/analytics/repository/PassEventRepository.js'
import type { PassEvent } from '../../../domain/analytics/entities/PassEvent.js'

export class PassEventPrismaRepository implements PassEventRepository {
  constructor(private readonly _db: PrismaClient) {}

  async save(event: PassEvent): Promise<void> {
    await this._db.passEvent.create({
      data: {
        id: event.id,
        organizationId: event.organizationId,
        walletId: event.walletId,
        passId: event.passId,
        type: event.type,
        metadata: (event.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        createdBy: event.createdBy,
        createdAt: new Date(event.createdAt),
      },
    })
  }
}
