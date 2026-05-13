import type { FastifyInstance } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import type { PassRepository } from '../../domain/pass/repository/PassRepository.js'
import type { WalletRepository } from '../../domain/wallet/repository/WalletRepository.js'
import type { ValidateDownloadTokenUseCase } from '../../application/pass/useCases/ValidateDownloadTokenUseCase.js'
import type { RedeemDownloadTokenUseCase } from '../../application/pass/useCases/RedeemDownloadTokenUseCase.js'
import { generatePkPass } from '../../infrastructure/apple/AppleWalletService.js'
import { generateGoogleWalletUrl } from '../../infrastructure/google/GoogleWalletService.js'
import { isValidAdminRequest } from '../middlewares/authenticate.js'

export function appleRoutes(
  db: PrismaClient,
  passRepo: PassRepository,
  walletRepo: WalletRepository,
  validateDownloadToken: ValidateDownloadTokenUseCase,
  redeemDownloadToken: RedeemDownloadTokenUseCase,
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

      const buffer = await generatePkPass(wallet, pass)

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

      const url = await generateGoogleWalletUrl(wallet, pass)

      if (dlToken) await redeemDownloadToken.run(dlToken)

      reply.redirect(url)
    })

    // Apple Wallet Web Service — register device
    app.post('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', async (request, reply) => {
      const { deviceLibraryIdentifier, serialNumber } = request.params as Record<string, string>
      const { pushToken } = request.body as { pushToken: string }

      if (!pushToken) return reply.code(400).send()

      const existing = await db.deviceRegistration.findUnique({
        where: { deviceLibraryIdentifier_passToken: { deviceLibraryIdentifier, passToken: serialNumber } },
      })

      if (existing) {
        await db.deviceRegistration.update({
          where: { id: existing.id },
          data: { pushToken },
        })
        return reply.code(200).send()
      }

      await db.deviceRegistration.create({
        data: { deviceLibraryIdentifier, passToken: serialNumber, pushToken },
      })
      reply.code(201).send()
    })

    // Apple Wallet Web Service — unregister device
    app.delete('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber', async (request, reply) => {
      const { deviceLibraryIdentifier, serialNumber } = request.params as Record<string, string>

      await db.deviceRegistration.deleteMany({
        where: { deviceLibraryIdentifier, passToken: serialNumber },
      })
      reply.code(200).send()
    })

    // Apple Wallet Web Service — get serial numbers for device
    app.get('/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier', async (request, reply) => {
      const { deviceLibraryIdentifier } = request.params as Record<string, string>

      const registrations = await db.deviceRegistration.findMany({
        where: { deviceLibraryIdentifier },
      })

      if (!registrations.length) return reply.code(204).send()

      const serialNumbers = registrations.map(r => r.passToken)

      reply.send({ serialNumbers, lastUpdated: new Date().toISOString() })
    })

    // Apple Wallet Web Service — get latest pass
    app.get('/v1/passes/:passTypeIdentifier/:serialNumber', async (request, reply) => {
      const { serialNumber } = request.params as Record<string, string>

      const pass = await passRepo.findByToken(serialNumber)
      if (!pass) return reply.code(404).send()

      const wallet = await walletRepo.findById(pass.walletId)
      if (!wallet) return reply.code(404).send()

      const buffer = await generatePkPass(wallet, pass)

      reply
        .header('Content-Type', 'application/vnd.apple.pkpass')
        .header('Last-Modified', new Date().toUTCString())
        .send(buffer)
    })

    // Apple Wallet Web Service — log errors
    app.post('/v1/log', async (request, reply) => {
      const body = request.body as { logs?: string[] }
      if (body?.logs) app.log.warn({ appleWalletLogs: body.logs }, 'Apple Wallet logs')
      reply.code(200).send()
    })
  }
}
