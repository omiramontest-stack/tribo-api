import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../infrastructure/database/prisma.js'
import { AppError } from '../application/common/AppError.js'

// Repositories
import { WalletPrismaRepository } from '../infrastructure/wallet/repository/WalletPrismaRepository.js'
import { PassPrismaRepository } from '../infrastructure/pass/repository/PassPrismaRepository.js'
import { AuthPrismaRepository } from '../infrastructure/auth/repository/AuthPrismaRepository.js'

// Use cases
import { LoginUseCase } from '../application/auth/useCases/LoginUseCase.js'
import { CreateWalletUseCase } from '../application/wallet/useCases/CreateWalletUseCase.js'
import { GetWalletsUseCase } from '../application/wallet/useCases/GetWalletsUseCase.js'
import { GetWalletByIdUseCase } from '../application/wallet/useCases/GetWalletByIdUseCase.js'
import { DeleteWalletUseCase } from '../application/wallet/useCases/DeleteWalletUseCase.js'
import { GeneratePassUseCase } from '../application/pass/useCases/GeneratePassUseCase.js'
import { GetPassByTokenUseCase } from '../application/pass/useCases/GetPassByTokenUseCase.js'
import { GetPassesByWalletUseCase } from '../application/pass/useCases/GetPassesByWalletUseCase.js'
import { UpdatePassDataUseCase } from '../application/pass/useCases/UpdatePassDataUseCase.js'

// Plugins & routes
import cookiesPlugin from './plugins/cookies.js'
import corsPlugin from './plugins/cors.js'
import { authRoutes } from './routes/auth.routes.js'
import { walletRoutes } from './routes/wallet.routes.js'
import { passRoutes } from './routes/pass.routes.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true })

  // Plugins
  await app.register(cookiesPlugin)
  await app.register(corsPlugin)

  // Composition root — wire repos → use cases
  const walletRepo = new WalletPrismaRepository(prisma)
  const passRepo = new PassPrismaRepository(prisma)
  const authRepo = new AuthPrismaRepository(prisma)

  const loginUseCase = new LoginUseCase(authRepo)
  const createWallet = new CreateWalletUseCase(walletRepo)
  const getWallets = new GetWalletsUseCase(walletRepo)
  const getWalletById = new GetWalletByIdUseCase(walletRepo)
  const deleteWallet = new DeleteWalletUseCase(walletRepo)
  const generatePass = new GeneratePassUseCase(walletRepo, passRepo)
  const getPassByToken = new GetPassByTokenUseCase(walletRepo, passRepo)
  const getPassesByWallet = new GetPassesByWalletUseCase(passRepo)
  const updatePassData = new UpdatePassDataUseCase(walletRepo, passRepo)

  // Routes
  app.register(authRoutes(loginUseCase))
  app.register(walletRoutes(createWallet, getWallets, getWalletById, deleteWallet))
  app.register(passRoutes(generatePass, getPassByToken, getPassesByWallet, updatePassData))

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message })
    }
    app.log.error(error)
    reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' })
  })

  return app
}
