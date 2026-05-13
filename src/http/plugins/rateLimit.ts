import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'

export default fp(async (app: FastifyInstance) => {
  await app.register(rateLimit, { global: false })
})

export const loginRateLimit = {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '15 minutes',
    },
  },
}

export const forgotPasswordRateLimit = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 hour',
    },
  },
}
