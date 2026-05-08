import type { PrismaClient } from '@prisma/client'
import type { InvitationRepository } from '../../../domain/organization/repository/InvitationRepository.js'
import type { Invitation, InvitationStatus } from '../../../domain/organization/entities/Invitation.js'
import type { MemberRole } from '../../../domain/organization/entities/OrganizationMember.js'

export class InvitationPrismaRepository implements InvitationRepository {
  constructor(private readonly _db: PrismaClient) {}

  async save(invitation: Invitation): Promise<Invitation> {
    const row = await this._db.invitation.create({
      data: {
        id: invitation.id,
        organizationId: invitation.organizationId,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        status: invitation.status,
        expiresAt: new Date(invitation.expiresAt),
      },
    })
    return this._toEntity(row)
  }

  async findByToken(token: string): Promise<Invitation | null> {
    const row = await this._db.invitation.findUnique({ where: { token } })
    return row ? this._toEntity(row) : null
  }

  async updateStatus(id: string, status: InvitationStatus): Promise<void> {
    await this._db.invitation.update({ where: { id }, data: { status } })
  }

  async findPendingByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null> {
    const row = await this._db.invitation.findFirst({
      where: { email, organizationId, status: 'pending' },
    })
    return row ? this._toEntity(row) : null
  }

  private _toEntity(row: {
    id: string
    organizationId: string
    email: string
    role: string
    token: string
    status: string
    expiresAt: Date
    createdAt: Date
  }): Invitation {
    return {
      id: row.id,
      organizationId: row.organizationId,
      email: row.email,
      role: row.role as MemberRole,
      token: row.token,
      status: row.status as InvitationStatus,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }
  }
}
