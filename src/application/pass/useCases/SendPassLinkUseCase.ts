import { randomBytes, randomUUID } from 'crypto'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { PassEventRepository } from '../../../domain/analytics/repository/PassEventRepository.js'
import type { PassDownloadTokenRepository } from '../../../domain/pass/repository/PassDownloadTokenRepository.js'
import { AppError } from '../../common/AppError.js'
import { sendPassLinkSms } from '../../../infrastructure/sms/SmsService.js'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function randomBase62(length: number): string {
  const bytes = randomBytes(length)
  return Array.from(bytes).map(b => CHARS[b % 62]).join('')
}

export interface SendPassLinkDto {
  token: string
  adminId: string
  organizationId: string
}

export class SendPassLinkUseCase {
  constructor(
    private readonly _passRepository: PassRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _passEventRepository: PassEventRepository,
    private readonly _downloadTokenRepository: PassDownloadTokenRepository,
  ) {}

  async run(dto: SendPassLinkDto): Promise<void> {
    const pass = await this._passRepository.findByToken(dto.token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const org = await this._orgRepository.findById(dto.organizationId)
    if (!org) throw new AppError('ORG_NOT_FOUND', 'Organization not found', 404)

    await this._downloadTokenRepository.invalidatePending(pass.id)

    const shortToken = randomBase62(8)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await this._downloadTokenRepository.save({
      id: randomUUID(),
      passId: pass.id,
      passToken: pass.token,
      token: shortToken,
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      createdAt: new Date().toISOString(),
    })

    const apiUrl = process.env.API_URL ?? 'http://localhost:3000'
    const downloadUrl = `${apiUrl}/dl/${shortToken}`

    await sendPassLinkSms({
      to: pass.phone,
      firstName: pass.firstName,
      organizationName: org.name,
      passUrl: downloadUrl,
    })

    await this._passEventRepository.save({
      id: randomUUID(),
      organizationId: dto.organizationId,
      walletId: pass.walletId,
      passId: pass.id,
      type: 'link_sent',
      metadata: null,
      createdBy: dto.adminId,
      createdAt: new Date().toISOString(),
    })
  }
}
