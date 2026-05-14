import type { PrismaClient } from '@prisma/client'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Organization } from '../../../domain/organization/entities/Organization.js'
import type { OrganizationMember, MemberRole } from '../../../domain/organization/entities/OrganizationMember.js'

export class OrganizationPrismaRepository implements OrganizationRepository {
  constructor(private readonly _db: PrismaClient) {}

  async save(org: Organization): Promise<Organization> {
    const row = await this._db.organization.create({
      data: {
        id: org.id,
        name: org.name,
        logoUrl: org.logoUrl,
        industry: org.industry,
        country: org.country,
        phone: org.phone,
      },
    })
    return this._toOrg(row)
  }

  async findById(id: string): Promise<Organization | null> {
    const row = await this._db.organization.findUnique({ where: { id } })
    return row ? this._toOrg(row) : null
  }

  async findByAdminId(adminId: string): Promise<Organization[]> {
    const memberships = await this._db.organizationMember.findMany({
      where: { adminId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    })
    return memberships.map(m => this._toOrg(m.organization))
  }

  async addMember(member: OrganizationMember): Promise<OrganizationMember> {
    const row = await this._db.organizationMember.create({
      data: {
        id: member.id,
        organizationId: member.organizationId,
        adminId: member.adminId,
        role: member.role,
      },
      include: { admin: { select: { email: true } } },
    })
    return this._toMember({ ...row, email: row.admin.email })
  }

  async findMembers(organizationId: string): Promise<OrganizationMember[]> {
    const rows = await this._db.organizationMember.findMany({
      where: { organizationId },
      include: { admin: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map(r => this._toMember({ ...r, email: r.admin.email }))
  }

  async isMember(adminId: string, organizationId: string): Promise<boolean> {
    const row = await this._db.organizationMember.findUnique({
      where: { organizationId_adminId: { organizationId, adminId } },
    })
    return row !== null
  }

  async getMemberRole(adminId: string, organizationId: string): Promise<MemberRole | null> {
    const row = await this._db.organizationMember.findUnique({
      where: { organizationId_adminId: { organizationId, adminId } },
    })
    return row ? (row.role as MemberRole) : null
  }

  async isEmailAlreadyMember(email: string, organizationId: string): Promise<boolean> {
    const row = await this._db.organizationMember.findFirst({
      where: { organizationId, admin: { email } },
    })
    return row !== null
  }

  async update(id: string, data: { name?: string; industry?: string | null; country?: string | null; phone?: string | null; logoUrl?: string | null; whatsappMessageTemplate?: string | null }): Promise<Organization> {
    const row = await this._db.organization.update({ where: { id }, data })
    return this._toOrg(row)
  }

  async findMemberById(memberId: string): Promise<OrganizationMember | null> {
    const row = await this._db.organizationMember.findUnique({
      where: { id: memberId },
      include: { admin: { select: { email: true } } },
    })
    if (!row) return null
    return this._toMember({ ...row, email: row.admin.email })
  }

  async updateMemberRole(memberId: string, role: MemberRole): Promise<OrganizationMember> {
    const row = await this._db.organizationMember.update({
      where: { id: memberId },
      data: { role },
      include: { admin: { select: { email: true } } },
    })
    return this._toMember({ ...row, email: row.admin.email })
  }

  async removeMember(memberId: string): Promise<void> {
    await this._db.organizationMember.delete({ where: { id: memberId } })
  }

  private _toOrg(row: {
    id: string
    name: string
    logoUrl: string | null
    industry: string | null
    country: string | null
    phone: string | null
    whatsappMessageTemplate?: string | null
    createdAt: Date
  }): Organization {
    return {
      id: row.id,
      name: row.name,
      logoUrl: row.logoUrl,
      industry: row.industry,
      country: row.country,
      phone: row.phone,
      whatsappMessageTemplate: row.whatsappMessageTemplate ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private _toMember(row: {
    id: string
    organizationId: string
    adminId: string
    role: string
    email: string
    createdAt: Date
  }): OrganizationMember {
    return {
      id: row.id,
      organizationId: row.organizationId,
      adminId: row.adminId,
      role: row.role as MemberRole,
      email: row.email,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
