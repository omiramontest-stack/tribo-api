import 'dotenv/config'
// dotenv must be the very first import so that TZ (and all env vars) are
// set before any Date operations or subsequent module initialisation.
import { validateEnv } from './config/env.js'
import { buildApp } from './http/app.js'
import { logger } from './infrastructure/logger/logger.js'

// Capturar errores no manejados ANTES de cualquier otra inicialización.
// En Node 15+, un unhandledRejection crashea el proceso sin log — con este
// handler al menos queda registrado en los logs antes de que Docker reinicie.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection — shutting down')
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down')
  process.exit(1)
})

validateEnv()

const { app, worker, whatsappManager, whatsappCleanup } = await buildApp()

worker.start()
whatsappCleanup.start()
// Restore WhatsApp sessions that were connected before the last restart
whatsappManager.restoreAll().catch(err => logger.error({ err }, '[WhatsApp] failed to restore sessions'))

const shutdown = async () => {
  worker.stop()
  whatsappCleanup.stop()
  await whatsappManager.destroyAll()
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown() })
process.on('SIGINT', () => { void shutdown() })

await app.listen({
  port: Number(process.env.PORT ?? 3000),
  host: '0.0.0.0',
})
