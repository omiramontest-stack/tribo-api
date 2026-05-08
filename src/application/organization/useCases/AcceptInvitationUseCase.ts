import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import type { InvitationRepository } from '../../../domain/organization/repository/InvitationRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { Admin } from '../../../domain/auth/entities/Admin.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'
import { GetInvitationUseCase } from './GetInvitationUseCase.js'

export interface AcceptInvitationDto {
  token: string
  password: string
}

export class AcceptInvitationUseCase implements UseCase<AcceptInvitationDto, Admin> {
  constructor(
    private readonly _invitationRepository: InvitationRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _authRepository: AuthRepository,
    private readonly _getInvitation: GetInvitationUseCase,
  ) {}

  async run(dto: AcceptInvitationDto): Promise<Admin> {
    const { invitation } = await this._getInvitation.run(dto.token)

    let admin: Admin
    const existing = await this._authRepository.findByEmail(invitation.email)

    if (existing) {
      admin = existing.admin
      const alreadyMember = await this._orgRepository.isMember(admin.id, invitation.organizationId)
      if (!alreadyMember) {
        await this._orgRepository.addMember({
          id: randomUUID(),
          organizationId: invitation.organizationId,
          adminId: admin.id,
          role: invitation.role,
          createdAt: new Date().toISOString(),
        })
      }
    } else {
      const passwordHash = await bcrypt.hash(dto.password, 10)
      admin = await this._authRepository.create({ email: invitation.email, passwordHash })
      await this._orgRepository.addMember({
        id: randomUUID(),
        organizationId: invitation.organizationId,
        adminId: admin.id,
        role: invitation.role,
        createdAt: new Date().toISOString(),
      })
    }

    await this._invitationRepository.updateStatus(invitation.id, 'accepted')

    return admin
  }
}
