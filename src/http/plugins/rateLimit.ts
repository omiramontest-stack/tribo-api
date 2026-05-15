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

// WhatsApp — connect/disconnect are destructive, keep very low
export const whatsappConnectRateLimit = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 hour',
    },
  },
}

// QR polling — frontend polls every 3s, allow up to 30 polls/min
export const whatsappQrRateLimit = {
  config: {
    rateLimit: {
      max: 30,
      timeWindow: '1 minute',
    },
  },
}

// Status checks — lightweight, but cap to avoid enumeration
export const whatsappStatusRateLimit = {
  config: {
    rateLimit: {
      max: 60,
      timeWindow: '1 minute',
    },
  },
}

// Sending — 1 per 5s enforced in-memory, but cap API calls too
export const sendWhatsAppRateLimit = {
  config: {
    rateLimit: {
      max: 20,
      timeWindow: '1 minute',
    },
  },
}
