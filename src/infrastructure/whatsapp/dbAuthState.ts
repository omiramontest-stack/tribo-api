import {
  initAuthCreds,
  BufferJSON,
  type AuthenticationState,
  type SignalDataSet,
} from '@whiskeysockets/baileys'
import type { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from './crypto.js'

// Types that don't need to be persisted for a send-only use case.
// lid-mapping accumulates thousands of entries (WhatsApp contact ID mappings)
// but is only needed for receiving group messages — not for outbound sends.
const SKIP_TYPES = new Set(['sender-key-memory', 'lid-mapping'])

// Flush to DB when pending buffer hits this size to bound memory usage.
const MAX_PENDING_KEYS = 50

// Force a flush at least every 30s even if Baileys keeps firing key updates,
// preventing the debounce timer from being reset indefinitely.
const FORCE_FLUSH_INTERVAL_MS = 30_000

export async function useDbAuthState(
  orgId: string,
  db: PrismaClient,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void>; flushAll: () => Promise<void> }> {
  const credsRow = await db.whatsAppAuthCreds.findUnique({
    where: { organizationId: orgId },
  })

  const creds = credsRow
    ? JSON.parse(decrypt(credsRow.data), BufferJSON.reviver)
    : initAuthCreds()

  const pendingKeys = new Map<string, unknown>()
  let keysFlushTimer: ReturnType<typeof setTimeout> | null = null
  let forceFlushTimer: ReturnType<typeof setInterval> | null = null

  async function flushKeys(): Promise<void> {
    if (keysFlushTimer) { clearTimeout(keysFlushTimer); keysFlushTimer = null }
    if (pendingKeys.size === 0) return

    const snapshot = new Map(pendingKeys)
    pendingKeys.clear()

    const ops: Promise<unknown>[] = []
    for (const [compositeKey, value] of snapshot) {
      const sep = compositeKey.indexOf(':')
      const type = compositeKey.slice(0, sep)
      const keyId = compositeKey.slice(sep + 1)

      if (value == null) {
        ops.push(db.whatsAppAuthKey.deleteMany({ where: { organizationId: orgId, type, keyId } }))
      } else {
        const encrypted = encrypt(JSON.stringify(value, BufferJSON.replacer))
        ops.push(
          db.whatsAppAuthKey.upsert({
            where: { organizationId_type_keyId: { organizationId: orgId, type, keyId } },
            create: { organizationId: orgId, type, keyId, data: encrypted },
            update: { data: encrypted },
          }),
        )
      }
    }
    await Promise.all(ops)
  }

  // Start periodic force-flush so the debounce can never stall indefinitely.
  forceFlushTimer = setInterval(() => { void flushKeys() }, FORCE_FLUSH_INTERVAL_MS)
  // Allow the interval to be GC'd if the Node process has nothing else to do.
  forceFlushTimer.unref()

  let credsFlushTimer: ReturnType<typeof setTimeout> | null = null
  let credsNeedsSave = false

  async function flushCreds(): Promise<void> {
    if (credsFlushTimer) { clearTimeout(credsFlushTimer); credsFlushTimer = null }
    if (!credsNeedsSave) return
    credsNeedsSave = false
    const encrypted = encrypt(JSON.stringify(creds, BufferJSON.replacer))
    await db.whatsAppAuthCreds.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, data: encrypted },
      update: { data: encrypted },
    })
  }

  const state: AuthenticationState = {
    creds,
    keys: {
      async get(type, ids) {
        if (SKIP_TYPES.has(type)) return {} as never

        const result: Record<string, unknown> = {}
        const dbIds: string[] = []

        for (const id of ids) {
          const buffered = pendingKeys.get(`${type}:${id}`)
          if (buffered !== undefined) {
            if (buffered !== null) result[id] = buffered
          } else {
            dbIds.push(id)
          }
        }

        if (dbIds.length > 0) {
          const rows = await db.whatsAppAuthKey.findMany({
            where: { organizationId: orgId, type, keyId: { in: dbIds } },
          })
          for (const row of rows) {
            result[row.keyId] = JSON.parse(decrypt(row.data), BufferJSON.reviver)
          }
        }

        return result as never
      },

      async set(data: SignalDataSet) {
        for (const [type, keys] of Object.entries(data)) {
          if (SKIP_TYPES.has(type)) continue
          for (const [keyId, value] of Object.entries(keys ?? {})) {
            pendingKeys.set(`${type}:${keyId}`, value ?? null)
          }
        }

        // Flush immediately if buffer is large to prevent unbounded memory growth.
        if (pendingKeys.size >= MAX_PENDING_KEYS) {
          void flushKeys()
          return
        }

        // Debounce small batches.
        if (keysFlushTimer) clearTimeout(keysFlushTimer)
        keysFlushTimer = setTimeout(() => { void flushKeys() }, 500)
      },
    },
  }

  const saveCreds = (): Promise<void> => {
    credsNeedsSave = true
    return new Promise((resolve) => {
      if (credsFlushTimer) clearTimeout(credsFlushTimer)
      credsFlushTimer = setTimeout(() => { void flushCreds().then(resolve) }, 2_000)
    })
  }

  const flushAll = async (): Promise<void> => {
    if (forceFlushTimer) { clearInterval(forceFlushTimer); forceFlushTimer = null }
    await Promise.all([flushCreds(), flushKeys()])
  }

  return { state, saveCreds, flushAll }
}
