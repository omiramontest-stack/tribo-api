import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Organization } from '../../../domain/organization/entities/Organization.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface UpdateOrganizationDto {
  organizationId: string
  requestingAdminId: string
  name?: string
  industry?: string | null
  country?: string | null
  phone?: string | null
  logoUrl?: string | null
  whatsappMessageTemplate?: string | null
}

export class UpdateOrganizationUseCase implements UseCase<UpdateOrganizationDto, Organization> {
  constructor(private readonly _orgRepository: OrganizationRepository) {}

  async run(dto: UpdateOrganizationDto): Promise<Organization> {
    const role = await this._orgRepository.getMemberRole(dto.requestingAdminId, dto.organizationId)
    if (!role || role === 'staff') throw new AppError('FORBIDDEN', 'No tienes permisos para editar esta organización', 403)

    const { organizationId, requestingAdminId: _, ...data } = dto
    return this._orgRepository.update(organizationId, data)
  }
}
