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
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const credsRow = await db.whatsAppAuthCreds.findUnique({
    where: { organizationId: orgId },
  })

  const creds = credsRow
    ? JSON.parse(decrypt(credsRow.data), BufferJSON.reviver)
    : initAuthCreds()

  const state: AuthenticationState = {
    creds,
    keys: {
      async get(type, ids) {
        const rows = await db.whatsAppAuthKey.findMany({
          where: { organizationId: orgId, type, keyId: { in: ids } },
        })
        const result: Record<string, unknown> = {}
        for (const row of rows) {
          result[row.keyId] = JSON.parse(decrypt(row.data), BufferJSON.reviver)
        }
        return result as never
      },

      async set(data: SignalDataSet) {
        const ops: Promise<unknown>[] = []
        for (const [type, keys] of Object.entries(data)) {
          for (const [keyId, value] of Object.entries(keys ?? {})) {
            if (value == null) {
              ops.push(
                db.whatsAppAuthKey.deleteMany({
                  where: { organizationId: orgId, type, keyId },
                }),
              )
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
        }
        await Promise.all(ops)
      },
    },
  }

  const saveCreds = async () => {
    const encrypted = encrypt(JSON.stringify(creds, BufferJSON.replacer))
    await db.whatsAppAuthCreds.upsert({
      where: { organizationId: orgId },
      create: { organizationId: orgId, data: encrypted },
      update: { data: encrypted },
    })
  }

  return { state, saveCreds }
}
