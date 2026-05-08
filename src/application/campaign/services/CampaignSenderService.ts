import type { CampaignChannel } from '../../../domain/campaign/entities/Campaign.js'
import type { ISender, SendPayload } from '../../../infrastructure/campaign/senders/ISender.js'

export class CampaignSenderService {
  constructor(private readonly _senders: Map<CampaignChannel, ISender>) {}

  async send(channel: CampaignChannel, payload: SendPayload): Promise<void> {
    const sender = this._senders.get(channel)
    if (!sender) throw new Error(`No sender registered for channel: ${channel}`)
    await sender.send(payload)
  }
}
