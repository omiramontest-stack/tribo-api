import { randomUUID } from 'crypto'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { AuthRepository } from '../../../domain/auth/repository/AuthRepository.js'
import type { OrganizationMember, MemberRole } from '../../../domain/organization/entities/OrganizationMember.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface AddMemberDto {
  organizationId: string
  requestingAdminId: string
  email: string
  role: MemberRole
}

export class AddMemberUseCase implements UseCase<AddMemberDto, OrganizationMember> {
  constructor(
    private readonly _orgRepository: OrganizationRepository,
    private readonly _authRepository: AuthRepository,
  ) {}

  async run(dto: AddMemberDto): Promise<OrganizationMember> {
    const isAuthorized = await this._orgRepository.isMember(dto.requestingAdminId, dto.organizationId)
    if (!isAuthorized) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const target = await this._authRepository.findByEmail(dto.email)
    if (!target) throw new AppError('USER_NOT_FOUND', 'No user found with that email', 404)

    const alreadyMember = await this._orgRepository.isMember(target.admin.id, dto.organizationId)
    if (alreadyMember) throw new AppError('ALREADY_MEMBER', 'User is already a member', 409)

    return this._orgRepository.addMember({
      id: randomUUID(),
      organizationId: dto.organizationId,
      adminId: target.admin.id,
      role: dto.role,
      createdAt: new Date().toISOString(),
    })
  }
}
