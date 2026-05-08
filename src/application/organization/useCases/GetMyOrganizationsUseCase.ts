import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { Organization } from '../../../domain/organization/entities/Organization.js'
import type { UseCase } from '../../common/UseCase.js'

export class GetMyOrganizationsUseCase implements UseCase<string, Organization[]> {
  constructor(private readonly _orgRepository: OrganizationRepository) {}

  async run(adminId: string): Promise<Organization[]> {
    return this._orgRepository.findByAdminId(adminId)
  }
}
