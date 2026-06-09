import type { PrismaClient } from '@prisma/client'
import type { ISender, SendPayload } from './ISender.js'
import { sendPassUpdateNotification } from '../../apple/ApnsService.js'

export class WalletPushSender implements ISender {
  constructor(private readonly _db: PrismaClient) {}

  async send(payload: SendPayload): Promise<void> {
    if (!payload.passToken) return

    // Guardar el mensaje en pass.data.lastMessage para que changeMessage lo muestre como notificación
    const pass = await this._db.pass.findUnique({
      where: { token: payload.passToken },
      select: { data: true },
    })
    if (!pass) return

    const updatedData = { ...(pass.data as object), lastMessage: payload.body }
    await this._db.pass.update({
      where: { token: payload.passToken },
      data: { data: updatedData, updatedAt: new Date() },
    })

    // Push silencioso: Apple Wallet descarga el pase actualizado y dispara changeMessage
    const registrations = await this._db.deviceRegistration.findMany({
      where: { passToken: payload.passToken },
      select: { pushToken: true },
    })
    if (registrations.length === 0) return

    await sendPassUpdateNotification(registrations.map((r) => r.pushToken))
  }
}
