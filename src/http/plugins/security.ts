import fp from 'fastify-plugin'
import helmet from '@fastify/helmet'
import type { FastifyInstance } from 'fastify'

const isProd = process.env.NODE_ENV === 'production'

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
        // Solo en producción: fuerza HTTP→HTTPS en el browser.
        // En desarrollo provoca que el browser intente HTTPS en localhost/ngrok
        // y rompe todas las requests cuando el túnel cambia de URL.
        ...(isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    // HSTS solo en producción: en dev el browser cachea el dominio como
    // HTTPS-only por 1 año, lo que mata todas las requests cuando ngrok
    // cambia de URL o el servidor corre en HTTP.
    hsts: isProd
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
  })

  // Limit request body to 1MB globally
  app.addHook('onRequest', async (request, reply) => {
    const contentLength = Number(request.headers['content-length'] ?? 0)
    if (contentLength > 1_048_576) {
      return reply.code(413).send({ error: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 1MB' })
    }
  })
})
