import type { MemberRole } from './OrganizationMember.js'

export type InvitationStatus = 'pending' | 'accepted' | 'expired'

export interface Invitation {
  id: string
  organizationId: string
  email: string
  role: MemberRole
  token: string
  status: InvitationStatus
  expiresAt: string
  createdAt: string
}
