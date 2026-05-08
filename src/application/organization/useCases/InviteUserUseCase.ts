import { randomUUID } from 'crypto'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { InvitationRepository } from '../../../domain/organization/repository/InvitationRepository.js'
import type { Invitation } from '../../../domain/organization/entities/Invitation.js'
import type { MemberRole } from '../../../domain/organization/entities/OrganizationMember.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'
import { sendInvitationEmail } from '../../../infrastructure/email/EmailService.js'

export interface InviteUserDto {
  organizationId: string
  requestingAdminId: string
  email: string
  role: 'admin' | 'staff'
}

export class InviteUserUseCase implements UseCase<InviteUserDto, Invitation> {
  constructor(
    private readonly _orgRepository: OrganizationRepository,
    private readonly _invitationRepository: InvitationRepository,
  ) {}

  async run(dto: InviteUserDto): Promise<Invitation> {
    const requesterRole = await this._orgRepository.getMemberRole(dto.requestingAdminId, dto.organizationId)
    if (!requesterRole || requesterRole === 'staff') {
      throw new AppError('FORBIDDEN', 'Only owners and admins can invite members', 403)
    }

    const org = await this._orgRepository.findById(dto.organizationId)
    if (!org) throw new AppError('ORG_NOT_FOUND', 'Organization not found', 404)

    const alreadyMember = await this._orgRepository.isEmailAlreadyMember(dto.email, dto.organizationId)
    if (alreadyMember) throw new AppError('ALREADY_MEMBER', 'User is already a member of this organization', 409)

    const pending = await this._invitationRepository.findPendingByEmailAndOrg(dto.email, dto.organizationId)
    if (pending) throw new AppError('INVITATION_EXISTS', 'A pending invitation already exists for this email', 409)

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const invitation = await this._invitationRepository.save({
      id: randomUUID(),
      organizationId: dto.organizationId,
      email: dto.email,
      role: dto.role as MemberRole,
      token: randomUUID(),
      status: 'pending',
      expiresAt,
      createdAt: new Date().toISOString(),
    })

    const clientUrl = (process.env.CLIENT_URL ?? 'http://localhost:5173').split(',')[0].trim()
    await sendInvitationEmail({
      to: dto.email,
      organizationName: org.name,
      role: dto.role,
      inviteUrl: `${clientUrl}/invite/${invitation.token}`,
    })

    return invitation
  }
}
