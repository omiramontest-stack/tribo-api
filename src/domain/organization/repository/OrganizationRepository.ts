import type { Organization } from '../entities/Organization.js'
import type { OrganizationMember, MemberRole } from '../entities/OrganizationMember.js'

export interface OrganizationRepository {
  save(org: Organization): Promise<Organization>
  update(id: string, data: { name?: string; industry?: string | null; country?: string | null; phone?: string | null; logoUrl?: string | null }): Promise<Organization>
  findById(id: string): Promise<Organization | null>
  findByAdminId(adminId: string): Promise<Organization[]>
  addMember(member: OrganizationMember): Promise<OrganizationMember>
  findMembers(organizationId: string): Promise<OrganizationMember[]>
  findMemberById(memberId: string): Promise<OrganizationMember | null>
  isMember(adminId: string, organizationId: string): Promise<boolean>
  getMemberRole(adminId: string, organizationId: string): Promise<MemberRole | null>
  isEmailAlreadyMember(email: string, organizationId: string): Promise<boolean>
  updateMemberRole(memberId: string, role: MemberRole): Promise<OrganizationMember>
  removeMember(memberId: string): Promise<void>
}
