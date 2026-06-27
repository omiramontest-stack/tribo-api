import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import type { PassRepository } from '../../domain/pass/repository/PassRepository.js'
import type { WalletRepository } from '../../domain/wallet/repository/WalletRepository.js'
import type { GeofenceRepository } from '../../domain/wallet/repository/GeofenceRepository.js'
import type { ValidateDownloadTokenUseCase } from '../../application/pass/useCases/ValidateDownloadTokenUseCase.js'
import type { RedeemDownloadTokenUseCase } from '../../application/pass/useCases/RedeemDownloadTokenUseCase.js'
import type { EffectiveWalletResolver } from '../../application/wallet/services/EffectiveWalletResolver.js'
import type { BrandingResolver } from '../../application/branding/BrandingResolver.js'
import type { Pass } from '../../domain/pass/entities/Pass.js'
import type { Wallet } from '../../domain/wallet/entities/Wallet.js'
import type { CashbackRules, GiftCardRules } from '../../domain/wallet/entities/WalletRules.js'
import { generatePkPass, type RecentTransaction } from '../../infrastructure/apple/AppleWalletService.js'
import { sendCampaignNotification } from '../../infrastructure/apple/ApnsService.js'
import { isGeofenceCurrentlyActive } from '../../application/wallet/utils/geofenceSchedule.js'
import { logger } from '../../infrastructure/logger/logger.js'
import { generateGoogleWalletUrl } from '../../infrastructure/google/GoogleWalletService.js'
import { isValidAdminRequest } from '../middlewares/authenticate.js'

/**
 * Valida el header "Authorization: ApplePass <authToken>" del protocolo Apple PassKit.
 * Apple envía este header en todas las requests al web service (registro, actualización, etc.).
 * Devuelve el authToken extraído, o null si el header está ausente o malformado.
 */
function extractAppleAuthToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization
  if (!auth?.startsWith('ApplePass ')) return null
  const token = auth.slice('ApplePass '.length).trim()
  return token.length > 0 ? token : null
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

async function buildRecentTransactions(db: PrismaClient, pass: Pass, wallet: Wallet): Promise<RecentTransaction[]> {
  const { type } = pass.data

  if (type === 'cashback') {
    const rules = wallet.rules as CashbackRules
    const txs = await db.cashbackTransaction.findMany({
      where: { passId: pass.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    return txs.map(tx => {
      if (tx.cashbackAmount <= 0)
        return { label: formatDate(tx.createdAt), value: `Canjeo ${rules.currency} ${Math.abs(tx.cashbackAmount).toFixed(2)}` }

      const isPromo = tx.cashbackPercent !== rules.cashbackPercent
      const percentLabel = isPromo ? ` (${tx.cashbackPercent}% promo)` : ` (${tx.cashbackPercent}%)`
      return {
        label: formatDate(tx.createdAt),
        value: `+${rules.currency} ${tx.cashbackAmount.toFixed(2)} · $${tx.purchaseAmount}${percentLabel}`,
      }
    })
  }

  if (type === 'giftcard') {
    const currency = (wallet.rules as GiftCardRules).currency
    const events = await db.passEvent.findMany({
      where: { passId: pass.id, type: { in: ['giftcard_credited', 'giftcard_redeemed'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    return events.map(ev => {
      const meta = ev.metadata as Record<string, unknown>
      const amount = (meta.amount as number).toFixed(2)
      return {
        label: formatDate(ev.createdAt),
        value: ev.type === 'giftcard_credited'
          ? `+${currency} ${amount} recargado`
          : `Usaste ${currency} ${amount}`,
      }
    })
  }

  if (type === 'stamps') {
    const events = await db.passEvent.findMany({
      where: { passId: pass.id, type: { in: ['stamp_added', 'stamp_redeemed'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    return events.map(ev => {
      const meta = ev.metadata as Record<string, unknown>
      return {
        label: formatDate(ev.createdAt),
        value: ev.type === 'stamp_redeemed'
          ? '¡Sellos completados!'
          : `Sello ${meta.currentStamps}/${meta.totalStamps}`,
      }
    })
  }

  if (type === 'points') {
    const events = await db.passEvent.findMany({
      where: { passId: pass.id, type: 'points_added' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    return events.map(ev => {
      const meta = ev.metadata as Record<string, unknown>
      return {
        label: formatDate(ev.createdAt),
        value: `+${meta.amount} puntos · Total: ${meta.currentPoints}`,
      }
    })
  }

  if (type === 'membership') {
    const events = await db.passEvent.findMany({
      where: { passId: pass.id, type: 'membership_renewed' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    return events.map(ev => ({ label: formatDate(ev.createdAt), value: 'Membresía renovada' }))
  }

  return []
}

export function appleRoutes(
  db: PrismaClient,
  passRepo: PassRepository,
  walletRepo: WalletRepository,
  geofenceRepo: GeofenceRepository,
  validateDownloadToken: ValidateDownloadTokenUseCase,
  redeemDownloadToken: RedeemDownloadTokenUseCase,
  effectiveWalletResolver: EffectiveWalletResolver,
  brandingResolver: BrandingResolver,
) {
  return async (app: FastifyInstance) => {

    // Download .pkpass — requires valid dl token (or admin session); marks token as used
    app.get('/passes/:token/apple', async (request, reply) => {
      const { token } = request.params as { token: string }
      const dlToken = (request.query as { dl?: string }).dl

      if (!isValidAdminRequest(request)) {
        if (!dlToken) return reply.code(401).send({ error: 'UNAUTHORIZED' })
        await validateDownloadToken.run(dlToken)
      }

      const pass = await passRepo.findByToken(token)
      if (!pass) return reply.code(404).send({ error: 'Pass not found' })

      const wallet = await walletRepo.findById(pass.walletId)
      if (!wallet) return reply.code(404).send({ error: 'Wallet not found' })

      const effectiveWallet = await effectiveWalletResolver.resolve(wallet, pass)
      const now = new Date()
      const [recentTransactions, activeGeofences, branding] = await Promise.all([
        buildRecentTransactions(db, pass, effectiveWallet),
        geofenceRepo.findActiveByWalletId(pass.walletId),
        brandingResolver.resolve(wallet.organizationId),
      ])
      const geofences = activeGeofences.filter(g => isGeofenceCurrentlyActive(g, now))
      const buffer = await generatePkPass(effectiveWallet, pass, recentTransactions, geofences, branding)

      if (dlToken) await redeemDownloadToken.run(dlToken)

      reply
        .header('Content-Type', 'application/vnd.apple.pkpass')
        .send(buffer)
    })

    // Google Wallet — requires valid dl token (or admin session); marks token as used
    app.get('/passes/:token/google', async (request, reply) => {
      const { token } = request.params as { token: string }
      const dlToken = (request.query as { dl?: string }).dl

      if (!isValidAdminRequest(request)) {
        if (!dlToken) return reply.code(401).send({ error: 'UNAUTHORIZED' })
        await validateDownloadToken.run(dlToken)
      }

      const pass = await passRepo.findByToken(token)
      if (!pass) return reply.code(404).send({ error: 'Pass not found' })

      const wallet = await walletRepo.findById(pass.walletId)
      if (!wallet) return reply.code(404).send({ error: 'Wallet not found' })

      const effectiveWallet = await effectiveWalletResolver.resolve(wallet, pass)
      const now = new Date()
      const [activeGeofences, branding] = await Promise.all([
        geofenceRepo.findActiveByWalletId(pass.walletId),
        brandingResolver.resolve(wallet.organizationId),
      ])
      const geofences = activeGeofences.filter(g => isGeofenceCurrentlyActive(g, now))

      const url = await generateGoogleWalletUrl(effectiveWallet, pass, geofences, branding)

      if (dlToken) await redeemDownloadToken.run(dlToken)

      reply.redirect(url)
    })

    // Apple Wallet Web Service — register device
    app.post('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', async (request, reply) => {
      const { deviceLibraryIdentifier, serialNumber } = request.params as Record<string, string>
      const { pushToken } = request.body as { pushToken: string }

      logger.info({ deviceLibraryIdentifier, serialNumber, hasPushToken: !!pushToken }, '[Apple] device registration attempt')

      if (!pushToken) return reply.code(400).send()

      // Validar "Authorization: ApplePass <authToken>" — protocolo Apple PassKit Web Service
      const authToken = extractAppleAuthToken(request)
      if (!authToken) {
        logger.warn({ serialNumber }, '[Apple] registration rejected: missing authToken')
        return reply.code(401).send()
      }

      const pass = await passRepo.findByTokenAndAuthToken(serialNumber, authToken)
      if (!pass) {
        logger.warn({ serialNumber }, '[Apple] registration rejected: pass not found or invalid authToken')
        return reply.code(401).send()
      }

      const existing = await db.deviceRegistration.findUnique({
        where: { deviceLibraryIdentifier_passToken: { deviceLibraryIdentifier, passToken: serialNumber } },
      })

      if (existing) {
        await db.deviceRegistration.update({
          where: { id: existing.id },
          data: { pushToken },
        })
        logger.info({ serialNumber }, '[Apple] device registration updated (200)')
        return reply.code(200).send()
      }

      await db.deviceRegistration.create({
        data: { deviceLibraryIdentifier, passToken: serialNumber, pushToken },
      })
      logger.info({ serialNumber, pushToken: pushToken.slice(-8) }, '[Apple] device registration created (201)')

      // Notificación de bienvenida al registrar el pase por primera vez
      const wallet = await db.wallet.findUnique({ where: { id: pass.walletId }, select: { businessName: true } })
      if (wallet) {
        sendCampaignNotification(
          [pushToken],
          wallet.businessName,
          `${pass.firstName}, bienvenido a ${wallet.businessName}. ¡Disfruta de tus ventajas y regalos! 🎁`,
        ).catch(() => {})
      }

      reply.code(201).send()
    })

    // Apple Wallet Web Service — unregister device
    app.delete('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', async (request, reply) => {
      const { deviceLibraryIdentifier, serialNumber } = request.params as Record<string, string>

      // Validar "Authorization: ApplePass <authToken>"
      const authToken = extractAppleAuthToken(request)
      if (!authToken) return reply.code(401).send()

      const pass = await passRepo.findByTokenAndAuthToken(serialNumber, authToken)
      if (!pass) return reply.code(401).send()

      await db.deviceRegistration.deleteMany({
        where: { deviceLibraryIdentifier, passToken: serialNumber },
      })
      reply.code(200).send()
    })

    // Apple Wallet Web Service — get serial numbers for device
    // Este endpoint es llamado por Apple para saber qué passes tiene un dispositivo —
    // no lleva authToken ya que no está atado a un pass específico. Sin embargo,
    // solo Apple debería llamarlo; lo dejamos sin auth ya que el deviceLibraryIdentifier
    // no expone datos sensibles más allá de los seriales.
    //
    // passesUpdatedSince: ISO timestamp enviado por Apple del último lastUpdated conocido.
    // Si está presente, solo devolvemos passes cuyo updatedAt sea posterior a ese timestamp,
    // evitando que una actualización de wallet X provoque re-descarga de passes de wallet Y.
    app.get('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier', async (request, reply) => {
      const { deviceLibraryIdentifier } = request.params as Record<string, string>
      const { passesUpdatedSince } = request.query as { passesUpdatedSince?: string }

      const registrations = await db.deviceRegistration.findMany({
        where: { deviceLibraryIdentifier },
        select: { passToken: true },
      })

      if (!registrations.length) return reply.code(204).send()

      const allTokens = registrations.map(r => r.passToken)

      let serialNumbers: string[]

      if (passesUpdatedSince) {
        const since = new Date(passesUpdatedSince)
        const updatedPasses = await db.pass.findMany({
          where: {
            token: { in: allTokens },
            updatedAt: { gt: since },
            deletedAt: null,
          },
          select: { token: true },
        })
        serialNumbers = updatedPasses.map(p => p.token)
      } else {
        serialNumbers = allTokens
      }

      if (!serialNumbers.length) return reply.code(204).send()

      reply.send({ serialNumbers, lastUpdated: new Date().toISOString() })
    })

    // Apple Wallet Web Service — get latest pass
    app.get('/v1/passes/:passTypeIdentifier/:serialNumber', async (request, reply) => {
      const { serialNumber } = request.params as Record<string, string>

      // Validar "Authorization: ApplePass <authToken>"
      const authToken = extractAppleAuthToken(request)
      if (!authToken) return reply.code(401).send()

      const pass = await passRepo.findByTokenAndAuthToken(serialNumber, authToken)

      if (!pass) {
        // Verificar si el pass existe pero fue soft-deleted (daypass escaneado).
        // Según el protocolo Apple PassKit, 410 Gone le indica al iPhone que debe
        // eliminar automáticamente el pass del Wallet del usuario.
        const deleted = await db.pass.findUnique({ where: { token: serialNumber } })
        if (deleted?.authToken === authToken && deleted.deletedAt !== null) {
          return reply.code(410).send()
        }
        return reply.code(401).send()
      }

      const wallet = await walletRepo.findById(pass.walletId)
      if (!wallet) return reply.code(404).send()

      const effectiveWallet = await effectiveWalletResolver.resolve(wallet, pass)
      const now = new Date()
      const [recentTransactions, activeGeofences, branding] = await Promise.all([
        buildRecentTransactions(db, pass, effectiveWallet),
        geofenceRepo.findActiveByWalletId(pass.walletId),
        brandingResolver.resolve(wallet.organizationId),
      ])
      const geofences = activeGeofences.filter(g => isGeofenceCurrentlyActive(g, now))
      const buffer = await generatePkPass(effectiveWallet, pass, recentTransactions, geofences, branding)

      reply
        .header('Content-Type', 'application/vnd.apple.pkpass')
        .header('Last-Modified', new Date().toUTCString())
        .send(buffer)
    })

    // Apple Wallet Web Service — log errors del dispositivo
    // No valida auth ya que Apple puede enviar logs sin estar atado a un pass.
    // Los logs se sanitizan: solo se registran como warn, sin exponer detalles al cliente.
    app.post('/v1/log', async (request, reply) => {
      const body = request.body as { logs?: unknown[] }
      if (Array.isArray(body?.logs)) {
        // Limitamos a 20 entradas para prevenir log injection masivo
        const safeLogs = body.logs.slice(0, 20).map(l => String(l).slice(0, 500))
        app.log.warn({ appleWalletLogs: safeLogs }, 'Apple Wallet device logs')
      }
      reply.code(200).send()
    })
  }
}
