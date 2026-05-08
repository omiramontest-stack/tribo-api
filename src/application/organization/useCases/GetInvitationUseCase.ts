import type { InvitationRepository } from '../../../domain/organization/repository/InvitationRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Invitation } from '../../../domain/organization/entities/Invitation.js'
import type { Organization } from '../../../domain/organization/entities/Organization.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface GetInvitationResult {
  invitation: Invitation
  organization: Organization
}

export class GetInvitationUseCase implements UseCase<string, GetInvitationResult> {
  constructor(
    private readonly _invitationRepository: InvitationRepository,
    private readonly _orgRepository: OrganizationRepository,
  ) {}

  async run(token: string): Promise<GetInvitationResult> {
    const invitation = await this._invitationRepository.findByToken(token)
    if (!invitation) throw new AppError('INVITATION_NOT_FOUND', 'Invitation not found', 404)

    if (invitation.status !== 'pending') throw new AppError('INVITATION_INVALID', 'Invitation is no longer valid', 410)
    if (new Date(invitation.expiresAt) < new Date()) {
      await this._invitationRepository.updateStatus(invitation.id, 'expired')
      throw new AppError('INVITATION_EXPIRED', 'Invitation has expired', 410)
    }

    const organization = await this._orgRepository.findById(invitation.organizationId)
    if (!organization) throw new AppError('ORG_NOT_FOUND', 'Organization not found', 404)

    return { invitation, organization }
  }
}
