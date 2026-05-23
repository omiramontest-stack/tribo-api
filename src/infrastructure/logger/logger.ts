/**
 * Shared pino logger instance.
 * All infrastructure services use this instead of console.log / console.error
 * so that log output is structured JSON (level, time, msg, …) and compatible
 * with the same Fastify pino transport used by the HTTP layer.
 *
 * Usage:
 *   import { logger } from '../../logger/logger.js'
 *   logger.info({ orgId }, 'session connected')
 *   logger.error({ err }, 'unexpected error')
 */
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
})
