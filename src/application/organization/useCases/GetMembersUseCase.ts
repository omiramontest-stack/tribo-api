import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { OrganizationMember } from '../../../domain/organization/entities/OrganizationMember.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'

export interface GetMembersDto {
  organizationId: string
  requestingAdminId: string
}

export class GetMembersUseCase implements UseCase<GetMembersDto, OrganizationMember[]> {
  constructor(private readonly _orgRepository: OrganizationRepository) {}

  async run(dto: GetMembersDto): Promise<OrganizationMember[]> {
    const isMember = await this._orgRepository.isMember(dto.requestingAdminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)
    return this._orgRepository.findMembers(dto.organizationId)
  }
}
