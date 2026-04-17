import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { Pass } from '../../../domain/pass/entities/Pass.js'
import type { UseCase } from '../../common/UseCase.js'

export class GetPassesByWalletUseCase implements UseCase<string, Pass[]> {
  constructor(private readonly _passRepository: PassRepository) {}

  async run(walletId: string): Promise<Pass[]> {
    return this._passRepository.findByWalletId(walletId)
  }
}
