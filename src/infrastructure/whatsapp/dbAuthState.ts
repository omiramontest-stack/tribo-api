import {
  initAuthCreds,
  BufferJSON,
  type AuthenticationState,
  type SignalDataSet,
} from '@whiskeysockets/baileys'
import type { PrismaClient } from '@prisma/client'
import { encrypt, decrypt } from './crypto.js'

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

  // In-memory buffer: key = `${type}:${keyId}`, value = null means delete
  const pendingKeys = new Map<string, unknown>()
  let keysFlushTimer: ReturnType<typeof setTimeout> | null = null

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
          // sender-key-memory is a local cache for group sends — not needed for our send-only use case
          if (type === 'sender-key-memory') continue
          for (const [keyId, value] of Object.entries(keys ?? {})) {
            pendingKeys.set(`${type}:${keyId}`, value ?? null)
          }
        }
        // Flush after 500ms of inactivity
        if (keysFlushTimer) clearTimeout(keysFlushTimer)
        keysFlushTimer = setTimeout(() => { void flushKeys() }, 500)
      },
    },
  }

  // Debounce credential saves: creds.update fires very frequently on reconnect
  const saveCreds = (): Promise<void> => {
    credsNeedsSave = true
    return new Promise((resolve) => {
      if (credsFlushTimer) clearTimeout(credsFlushTimer)
      credsFlushTimer = setTimeout(() => { void flushCreds().then(resolve) }, 2_000)
    })
  }

  // Call before destroying the session to ensure no pending writes are lost
  const flushAll = async (): Promise<void> => {
    await Promise.all([flushCreds(), flushKeys()])
  }

  return { state, saveCreds, flushAll }
}

