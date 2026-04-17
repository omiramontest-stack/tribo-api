import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import type { FastifyInstance } from 'fastify'

export default fp(async (app: FastifyInstance) => {
  app.register(cookie)
})
