import type { PrismaClient } from '@prisma/client'
import type { ISender, SendPayload } from './ISender.js'
import { sendCampaignNotification } from '../../apple/ApnsService.js'

export class WalletPushSender implements ISender {
  constructor(private readonly _db: PrismaClient) {}

  async send(payload: SendPayload): Promise<void> {
    if (!payload.passToken) return

    const registrations = await this._db.deviceRegistration.findMany({
      where: { passToken: payload.passToken },
      select: { pushToken: true },
    })

    if (registrations.length === 0) return

    await sendCampaignNotification(
      registrations.map((r) => r.pushToken),
      payload.organizationName,
      payload.body,
    )
  }
}
