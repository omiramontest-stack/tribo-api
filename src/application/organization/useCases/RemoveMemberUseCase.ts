import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface RemoveMemberDto {
  organizationId: string
  requestingAdminId: string
  memberId: string
}

export class RemoveMemberUseCase implements UseCase<RemoveMemberDto, void> {
  constructor(private readonly _orgRepository: OrganizationRepository) {}

  async run(dto: RemoveMemberDto): Promise<void> {
    const requestingRole = await this._orgRepository.getMemberRole(dto.requestingAdminId, dto.organizationId)
    if (!requestingRole || requestingRole === 'staff') {
      throw new AppError('FORBIDDEN', 'No tienes permisos para eliminar miembros', 403)
    }

    const member = await this._orgRepository.findMemberById(dto.memberId)
    if (!member || member.organizationId !== dto.organizationId) {
      throw new AppError('MEMBER_NOT_FOUND', 'Miembro no encontrado', 404)
    }

    if (member.adminId === dto.requestingAdminId) {
      throw new AppError('CANNOT_REMOVE_SELF', 'No puedes eliminarte a ti mismo', 400)
    }

    if (member.role === 'owner') {
      throw new AppError('CANNOT_REMOVE_OWNER', 'No se puede eliminar al owner', 400)
    }

    if (requestingRole === 'admin' && member.role === 'admin') {
      throw new AppError('FORBIDDEN', 'Un admin no puede eliminar a otro admin', 403)
    }

    await this._orgRepository.removeMember(dto.memberId)
  }
}
