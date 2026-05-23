import type { PrismaClient } from '@prisma/client'
import type { IWorker } from '../campaign/worker/CampaignWorker.js'
import { logger } from '../logger/logger.js'

const INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // weekly

// Pre-keys are one-time-use; after 30 days they've been consumed or are stale
const PRE_KEY_MAX_AGE_DAYS = 30

// Keep only the last N app-state-sync-key entries per org — enough for re-sync
const APP_STATE_SYNC_KEY_KEEP = 5

export class WhatsAppCleanupWorker implements IWorker {
  private _timer: ReturnType<typeof setInterval> | null = null
  private _running = false

  constructor(private readonly _db: PrismaClient) {}

  start(): void {
    if (this._timer) return
    void this._tick()
    this._timer = setInterval(() => { void this._tick() }, INTERVAL_MS)
    logger.info('[WhatsAppCleanup] started — running weekly')
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  private async _tick(): Promise<void> {
    if (this._running) return
    this._running = true
    try {
      await this._prunePreKeys()
      await this._pruneAppStateSyncKeys()
      await this._pruneOrphanedKeys()
    } catch (err) {
      logger.error({ err }, '[WhatsAppCleanup] error during cleanup')
    } finally {
      this._running = false
    }
  }

  // Pre-keys older than 30 days have been consumed or are stale
  private async _prunePreKeys(): Promise<void> {
    const cutoff = new Date(Date.now() - PRE_KEY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
    const { count } = await this._db.whatsAppAuthKey.deleteMany({
      where: { type: 'pre-key', updatedAt: { lt: cutoff } },
    })
    if (count > 0) logger.info({ count }, '[WhatsAppCleanup] deleted stale pre-keys')
  }

  // app-state-sync-key accumulates versions — keep only the most recent N per org
  private async _pruneAppStateSyncKeys(): Promise<void> {
    const orgs = await this._db.whatsAppAuthKey.findMany({
      where: { type: 'app-state-sync-key' },
      distinct: ['organizationId'],
      select: { organizationId: true },
    })

    let total = 0
    for (const { organizationId } of orgs) {
      const rows = await this._db.whatsAppAuthKey.findMany({
        where: { type: 'app-state-sync-key', organizationId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      const toDelete = rows.slice(APP_STATE_SYNC_KEY_KEEP).map(r => r.id)
      if (toDelete.length > 0) {
        const { count } = await this._db.whatsAppAuthKey.deleteMany({ where: { id: { in: toDelete } } })
        total += count
      }
    }
    if (total > 0) logger.info({ total }, '[WhatsAppCleanup] pruned old app-state-sync-key entries')
  }

  // Remove all auth keys for orgs that no longer have an active WhatsApp session
  private async _pruneOrphanedKeys(): Promise<void> {
    const activeSessions = await this._db.whatsAppSession.findMany({
      select: { organizationId: true },
    })
    const activeOrgIds = new Set(activeSessions.map(s => s.organizationId))

    const orphanedOrgs = await this._db.whatsAppAuthKey.findMany({
      distinct: ['organizationId'],
      select: { organizationId: true },
    })

    const orphaned = orphanedOrgs
      .map(r => r.organizationId)
      .filter(id => !activeOrgIds.has(id))

    if (orphaned.length === 0) return

    const { count } = await this._db.whatsAppAuthKey.deleteMany({
      where: { organizationId: { in: orphaned } },
    })
    logger.info({ count, inactiveOrgs: orphaned.length }, '[WhatsAppCleanup] deleted orphaned keys')
  }
}
