import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import type { FastifyInstance } from 'fastify'

export default fp(async (app: FastifyInstance) => {
  app.register(cors, {
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  })
})
