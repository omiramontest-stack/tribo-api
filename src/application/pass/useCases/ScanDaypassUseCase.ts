import { randomUUID } from 'crypto'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { PassEventRepository } from '../../../domain/analytics/repository/PassEventRepository.js'
import type { UseCase } from '../../common/UseCase.js'
import { AppError } from '../../common/AppError.js'
import { sendPassUpdateNotification } from '../../../infrastructure/apple/ApnsService.js'

export interface ScanDaypassDto {
  token: string
}

export interface ScanDaypassResult {
  used: boolean
  firstName: string
  lastName: string
  eventName: string
}

export class ScanDaypassUseCase implements UseCase<ScanDaypassDto, ScanDaypassResult> {
  constructor(
    private readonly _passRepository: PassRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _passEventRepository: PassEventRepository,
  ) {}

  async run(dto: ScanDaypassDto): Promise<ScanDaypassResult> {
    const pass = await this._passRepository.findByToken(dto.token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.type !== 'daypass') throw new AppError('INVALID_PASS_TYPE', 'This pass is not a daypass', 400)

    if (pass.data.type === 'daypass' && pass.data.used) {
      throw new AppError('PASS_ALREADY_USED', 'This daypass has already been used', 409)
    }

    pass.data = { type: 'daypass', used: true }
    await this._passRepository.update(pass)

    // Obtener push tokens ANTES del soft-delete (aunque deviceRegistration no filtra por
    // deletedAt, es más claro hacerlo antes; también permite enviar el push primero).
    const pushTokens = await this._passRepository.findPushTokensByPassToken(pass.token)

    // Soft-delete — mueve el pass a la lista de "escaneados" en el dashboard de admin.
    await this._passRepository.delete(pass.id)

    // Notificar a Apple: el iPhone llamará a GET /v1/passes/… y recibirá 410 Gone,
    // lo que le indica que debe eliminar el pass del Wallet automáticamente.
    await sendPassUpdateNotification(pushTokens)

    await this._passEventRepository.save({
      id: randomUUID(),
      organizationId: wallet.organizationId,
      walletId: wallet.id,
      passId: pass.id,
      type: 'daypass_scanned',
      metadata: { eventName: (wallet.rules as { eventName: string }).eventName },
      createdBy: null,
      createdAt: new Date().toISOString(),
    })

    const rules = wallet.rules as { eventName: string }

    return {
      used: true,
      firstName: pass.firstName,
      lastName: pass.lastName,
      eventName: rules.eventName,
    }
  }
}
