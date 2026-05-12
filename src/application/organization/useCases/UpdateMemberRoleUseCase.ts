import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { OrganizationMember, MemberRole } from '../../../domain/organization/entities/OrganizationMember.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface UpdateMemberRoleDto {
  organizationId: string
  requestingAdminId: string
  memberId: string
  role: MemberRole
}

export class UpdateMemberRoleUseCase implements UseCase<UpdateMemberRoleDto, OrganizationMember> {
  constructor(private readonly _orgRepository: OrganizationRepository) {}

  async run(dto: UpdateMemberRoleDto): Promise<OrganizationMember> {
    const requestingRole = await this._orgRepository.getMemberRole(dto.requestingAdminId, dto.organizationId)
    if (requestingRole !== 'owner') throw new AppError('FORBIDDEN', 'Solo el owner puede cambiar roles', 403)

    const member = await this._orgRepository.findMemberById(dto.memberId)
    if (!member || member.organizationId !== dto.organizationId) {
      throw new AppError('MEMBER_NOT_FOUND', 'Miembro no encontrado', 404)
    }

    if (member.adminId === dto.requestingAdminId) {
      throw new AppError('CANNOT_CHANGE_OWN_ROLE', 'No puedes cambiar tu propio rol', 400)
    }

    if (dto.role === 'owner') {
      throw new AppError('CANNOT_ASSIGN_OWNER', 'No se puede asignar el rol owner', 400)
    }

    return this._orgRepository.updateMemberRole(dto.memberId, dto.role)
  }
}
