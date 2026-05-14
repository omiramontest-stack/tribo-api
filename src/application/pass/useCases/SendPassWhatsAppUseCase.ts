import { randomBytes, randomUUID } from 'crypto'
import type { PassRepository } from '../../../domain/pass/repository/PassRepository.js'
import type { WalletRepository } from '../../../domain/wallet/repository/WalletRepository.js'
import type { OrganizationRepository } from '../../../domain/organization/repository/OrganizationRepository.js'
import type { PassEventRepository } from '../../../domain/analytics/repository/PassEventRepository.js'
import type { PassDownloadTokenRepository } from '../../../domain/pass/repository/PassDownloadTokenRepository.js'
import type { WhatsAppSessionManager } from '../../../infrastructure/whatsapp/WhatsAppSessionManager.js'
import { AppError } from '../../common/AppError.js'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const DEFAULT_TEMPLATE = 'Hola {nombre}, aquí está tu wallet de {negocio}: {link}'

function randomBase62(length: number): string {
  const bytes = randomBytes(length)
  return Array.from(bytes).map(b => CHARS[b % 62]).join('')
}

function buildMessage(template: string, vars: { nombre: string; negocio: string; link: string }): string {
  return template
    .replace(/{nombre}/g, vars.nombre)
    .replace(/{negocio}/g, vars.negocio)
    .replace(/{link}/g, vars.link)
}

export interface SendPassWhatsAppDto {
  token: string
  adminId: string
  organizationId: string
}

export class SendPassWhatsAppUseCase {
  constructor(
    private readonly _passRepository: PassRepository,
    private readonly _walletRepository: WalletRepository,
    private readonly _orgRepository: OrganizationRepository,
    private readonly _passEventRepository: PassEventRepository,
    private readonly _downloadTokenRepository: PassDownloadTokenRepository,
    private readonly _whatsapp: WhatsAppSessionManager,
  ) {}

  async run(dto: SendPassWhatsAppDto): Promise<void> {
    const pass = await this._passRepository.findByToken(dto.token)
    if (!pass) throw new AppError('PASS_NOT_FOUND', 'Pass not found', 404)

    const wallet = await this._walletRepository.findById(pass.walletId)
    if (!wallet) throw new AppError('WALLET_NOT_FOUND', 'Wallet not found', 404)

    if (wallet.organizationId !== dto.organizationId) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const isMember = await this._orgRepository.isMember(dto.adminId, dto.organizationId)
    if (!isMember) throw new AppError('FORBIDDEN', 'Forbidden', 403)

    const org = await this._orgRepository.findById(dto.organizationId)
    if (!org) throw new AppError('ORG_NOT_FOUND', 'Organization not found', 404)

    if (this._whatsapp.getStatus(dto.organizationId) !== 'connected') {
      throw new AppError('WHATSAPP_NOT_CONNECTED', 'WhatsApp no está conectado para esta organización', 422)
    }

    await this._downloadTokenRepository.invalidatePending(pass.id)

    const shortToken = randomBase62(8)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

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

    const template = org.whatsappMessageTemplate ?? DEFAULT_TEMPLATE
    const message = buildMessage(template, {
      nombre: pass.firstName,
      negocio: org.name,
      link: downloadUrl,
    })

    await this._whatsapp.sendMessage(dto.organizationId, pass.phone, message)

    await this._passEventRepository.save({
      id: randomUUID(),
      organizationId: dto.organizationId,
      walletId: pass.walletId,
      passId: pass.id,
      type: 'link_sent',
      metadata: { channel: 'whatsapp' },
      createdBy: dto.adminId,
      createdAt: new Date().toISOString(),
    })
  }
}
