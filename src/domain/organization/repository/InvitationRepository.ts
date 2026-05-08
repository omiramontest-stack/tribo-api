import type { Invitation, InvitationStatus } from '../entities/Invitation.js'

export interface InvitationRepository {
  save(invitation: Invitation): Promise<Invitation>
  findByToken(token: string): Promise<Invitation | null>
  updateStatus(id: string, status: InvitationStatus): Promise<void>
  findPendingByEmailAndOrg(email: string, organizationId: string): Promise<Invitation | null>
}
