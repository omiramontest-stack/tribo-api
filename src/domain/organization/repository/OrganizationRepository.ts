import type { Organization } from '../entities/Organization.js'
import type { OrganizationMember, MemberRole } from '../entities/OrganizationMember.js'

export interface OrganizationRepository {
  save(org: Organization): Promise<Organization>
  findById(id: string): Promise<Organization | null>
  findByAdminId(adminId: string): Promise<Organization[]>
  addMember(member: OrganizationMember): Promise<OrganizationMember>
  findMembers(organizationId: string): Promise<OrganizationMember[]>
  isMember(adminId: string, organizationId: string): Promise<boolean>
  getMemberRole(adminId: string, organizationId: string): Promise<MemberRole | null>
  isEmailAlreadyMember(email: string, organizationId: string): Promise<boolean>
}
