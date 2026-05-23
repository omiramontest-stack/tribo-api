import type { CampaignRepository } from '../../../domain/campaign/repository/CampaignRepository.js'
import type { CampaignSenderService } from '../services/CampaignSenderService.js'
import type { BillingRepository } from '../../../domain/billing/repository/BillingRepository.js'
import { renderTemplate, countSmsSegments, MAX_SMS_SEGMENTS } from '../services/TemplateEngine.js'

const BATCH_SIZE = 50

export class ProcessCampaignsUseCase {
  constructor(
    private readonly _campaignRepository: CampaignRepository,
    private readonly _senderService: CampaignSenderService,
    private readonly _billingRepository: BillingRepository,
  ) {}

  async run(): Promise<void> {
    // claimDueCampaigns() hace SELECT FOR UPDATE SKIP LOCKED + UPDATE status='sending'
    // en una sola transacción, garantizando que ningún otro worker tome la misma campaña.
    const campaigns = await this._campaignRepository.claimDueCampaigns()

    for (const campaign of campaigns) {

      let totalSent = 0
      let totalFailed = 0

      while (true) {
        const recipients = await this._campaignRepository.findPendingRecipients(campaign.id, BATCH_SIZE)
        if (recipients.length === 0) break

        const results = await Promise.allSettled(
          recipients.map(async (recipient) => {
            const to = campaign.channel === 'sms'
              ? recipient.phone
              : campaign.channel === 'email'
                ? recipient.email
                : recipient.pushToken

            if (!to) {
              await this._campaignRepository.markRecipientSkipped(recipient.id)
              return 'skipped'
            }

            const body = renderTemplate(campaign.messageTemplate, recipient.variables)

            if (campaign.channel === 'sms') {
              const segments = countSmsSegments(body)
              if (segments > MAX_SMS_SEGMENTS) {
                await this._campaignRepository.markRecipientSkipped(recipient.id)
                return 'skipped'
              }
              // Deducción atómica: UPDATE con WHERE balance >= segments.
              // Si devuelve false, el balance era insuficiente — sin race condition posible.
              const deducted = await this._billingRepository.tryDeductSmsCredits(campaign.organizationId, segments)
              if (!deducted) {
                await this._campaignRepository.markRecipientFailed(recipient.id, 'insufficient_sms_credits')
                return 'failed'
              }
              await this._senderService.send(campaign.channel, {
                to,
                body,
                organizationName: recipient.variables.organizationName ?? '',
                passUrl: recipient.variables.passUrl,
                passToken: recipient.variables.passToken,
              })
              await this._campaignRepository.markRecipientSent(recipient.id)
              return 'sent'
            }

            await this._senderService.send(campaign.channel, {
              to,
              body,
              organizationName: recipient.variables.organizationName ?? '',
              passUrl: recipient.variables.passUrl,
              passToken: recipient.variables.passToken,
            })

            await this._campaignRepository.markRecipientSent(recipient.id)
            return 'sent'
          }),
        )

        for (let i = 0; i < results.length; i++) {
          const result = results[i]
          if (result.status === 'fulfilled' && result.value === 'sent') {
            totalSent++
          } else if (result.status === 'fulfilled' && result.value === 'failed') {
            totalFailed++
          } else if (result.status === 'rejected') {
            totalFailed++
            const error = result.reason instanceof Error ? result.reason.message : String(result.reason)
            await this._campaignRepository.markRecipientFailed(recipients[i].id, error)
          }
        }

        await this._campaignRepository.incrementStats(campaign.id, totalSent, totalFailed)
        totalSent = 0
        totalFailed = 0
      }

      await this._campaignRepository.updateStatus(campaign.id, 'sent', new Date().toISOString())
    }
  }
}
