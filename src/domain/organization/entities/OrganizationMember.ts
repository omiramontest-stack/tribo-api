export type MemberRole = 'owner' | 'admin' | 'staff'

export interface OrganizationMember {
  id: string
  organizationId: string
  adminId: string
  role: MemberRole
  email?: string
  createdAt: string
}
