import fp from 'fastify-plugin'
import helmet from '@fastify/helmet'
import type { FastifyInstance } from 'fastify'

export default fp(async (app: FastifyInstance) => {
  await app.register(helmet, {
    // Allow Apple Wallet and Google Wallet passes to be served
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },
  })

  // Limit request body to 1MB globally
  app.addHook('onRequest', async (request, reply) => {
    const contentLength = Number(request.headers['content-length'] ?? 0)
    if (contentLength > 1_048_576) {
      return reply.code(413).send({ error: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 1MB' })
    }
  })
})
