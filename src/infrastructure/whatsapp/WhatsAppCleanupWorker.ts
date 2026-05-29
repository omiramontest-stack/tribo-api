import type { PrismaClient } from '@prisma/client'
import type { IWorker } from '../campaign/worker/CampaignWorker.js'
import { logger } from '../logger/logger.js'

const INTERVAL_MS = 24 * 60 * 60 * 1000 // daily

// Pre-keys are one-time use — stale after 7 days
const PRE_KEY_MAX_AGE_DAYS = 7

// Hard cap on pre-keys per org regardless of age.
// Baileys generates 100 pre-keys per registration; keeping 200 is plenty.
const PRE_KEY_MAX_PER_ORG = 200

// lid-mapping entries accumulate for every contact WhatsApp routes through.
// They are not needed for a send-only use case and can be removed after a few days.
const LID_MAPPING_MAX_AGE_DAYS = 3

// Keep only the last N app-state-sync-key entries per org
const APP_STATE_SYNC_KEY_KEEP = 3

export class WhatsAppCleanupWorker implements IWorker {
  private _timer: ReturnType<typeof setInterval> | null = null
  private _running = false

  constructor(private readonly _db: PrismaClient) {}

  start(): void {
    if (this._timer) return
    void this._tick()
    this._timer = setInterval(() => { void this._tick() }, INTERVAL_MS)
    logger.info('[WhatsAppCleanup] started — running daily')
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
      await this._pruneLidMappings()
      await this._prunePreKeysByAge()
      await this._prunePreKeysByCount()
      await this._pruneAppStateSyncKeys()
      await this._pruneOrphanedKeys()
    } catch (err) {
      logger.error({ err }, '[WhatsAppCleanup] error during cleanup')
    } finally {
      this._running = false
    }
  }

  // lid-mapping entries are not needed for send-only and accumulate fast.
  private async _pruneLidMappings(): Promise<void> {
    const cutoff = new Date(Date.now() - LID_MAPPING_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
    const { count } = await this._db.whatsAppAuthKey.deleteMany({
      where: { type: 'lid-mapping', updatedAt: { lt: cutoff } },
    })
    if (count > 0) logger.info({ count }, '[WhatsAppCleanup] deleted stale lid-mapping entries')
  }

  // Delete pre-keys older than PRE_KEY_MAX_AGE_DAYS.
  private async _prunePreKeysByAge(): Promise<void> {
    const cutoff = new Date(Date.now() - PRE_KEY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000)
    const { count } = await this._db.whatsAppAuthKey.deleteMany({
      where: { type: 'pre-key', updatedAt: { lt: cutoff } },
    })
    if (count > 0) logger.info({ count }, '[WhatsAppCleanup] deleted stale pre-keys by age')
  }

  // Enforce a hard cap on pre-keys per org to handle reconnect storms.
  // Keeps the PRE_KEY_MAX_PER_ORG most-recently-updated keys.
  private async _prunePreKeysByCount(): Promise<void> {
    const orgs = await this._db.whatsAppAuthKey.findMany({
      where: { type: 'pre-key' },
      distinct: ['organizationId'],
      select: { organizationId: true },
    })

    let total = 0
    for (const { organizationId } of orgs) {
      const rows = await this._db.whatsAppAuthKey.findMany({
        where: { type: 'pre-key', organizationId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
        skip: PRE_KEY_MAX_PER_ORG,
      })
      if (rows.length === 0) continue
      const { count } = await this._db.whatsAppAuthKey.deleteMany({
        where: { id: { in: rows.map(r => r.id) } },
      })
      total += count
    }
    if (total > 0) logger.info({ total }, '[WhatsAppCleanup] deleted excess pre-keys by count cap')
  }

  // Keep only the most recent N app-state-sync-key entries per org.
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
        skip: APP_STATE_SYNC_KEY_KEEP,
      })
      if (rows.length === 0) continue
      const { count } = await this._db.whatsAppAuthKey.deleteMany({
        where: { id: { in: rows.map(r => r.id) } },
      })
      total += count
    }
    if (total > 0) logger.info({ total }, '[WhatsAppCleanup] pruned old app-state-sync-key entries')
  }

  // Remove all auth keys for orgs that no longer have an active WhatsApp session.
  // Uses a subquery instead of loading both sets into memory.
  private async _pruneOrphanedKeys(): Promise<void> {
    const activeSessions = await this._db.whatsAppSession.findMany({
      select: { organizationId: true },
    })
    const activeOrgIds = activeSessions.map(s => s.organizationId)

    if (activeOrgIds.length === 0) {
      // No active sessions — purge everything
      const { count } = await this._db.whatsAppAuthKey.deleteMany({})
      if (count > 0) logger.info({ count }, '[WhatsAppCleanup] purged all orphaned keys (no active sessions)')
      return
    }

    const { count } = await this._db.whatsAppAuthKey.deleteMany({
      where: { organizationId: { notIn: activeOrgIds } },
    })
    if (count > 0) logger.info({ count }, '[WhatsAppCleanup] deleted orphaned keys')
  }
}
