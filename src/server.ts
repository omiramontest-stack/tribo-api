import 'dotenv/config'
import { buildApp } from './http/app.js'

const { app, worker, whatsappManager } = await buildApp()

worker.start()
// Restore WhatsApp sessions that were connected before the last restart
whatsappManager.restoreAll().catch(err => console.error('[WhatsApp] Failed to restore sessions:', err))

const shutdown = async () => {
  worker.stop()
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', () => { void shutdown() })
process.on('SIGINT', () => { void shutdown() })

await app.listen({
  port: Number(process.env.PORT ?? 3000),
  host: '0.0.0.0',
})
