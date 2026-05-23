/**
 * Tests — Campaign Processing flow (Fix-22 / Flow 3)
 *
 * Tests the critical invariants of ProcessCampaignsUseCase:
 *   - No due campaigns → nothing happens
 *   - SMS campaign: deducts credits per segment and marks recipient sent
 *   - SMS campaign: marks recipient failed when credits are insufficient (no race condition)
 *   - Recipients with no `to` address are skipped
 *   - Final status updated to 'sent'
 */
import { describe, it, expect, mock } from 'bun:test'
import { ProcessCampaignsUseCase } from '../application/campaign/useCases/ProcessCampaignsUseCase.js'
import type { CampaignRepository } from '../domain/campaign/repository/CampaignRepository.js'
import type { CampaignSenderService } from '../application/campaign/services/CampaignSenderService.js'
import type { BillingRepository } from '../domain/billing/repository/BillingRepository.js'
import type { Campaign } from '../domain/campaign/entities/Campaign.js'
import type { CampaignRecipient } from '../domain/campaign/entities/CampaignRecipient.js'

const CAMPAIGN: Campaign = {
  id: 'camp-1',
  organizationId: 'org-1',
  walletId: 'wallet-1',
  name: 'Test Campaign',
  description: null,
  channel: 'sms',
  status: 'scheduled',
  segment: { type: 'all' } as never,
  messageTemplate: 'Hello {{firstName}}!',
  scheduledAt: new Date(Date.now() - 1000).toISOString(),
  sentAt: null,
  createdBy: 'admin-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  totalRecipients: 1,
  totalSent: 0,
  totalFailed: 0,
}

const RECIPIENT: CampaignRecipient = {
  id: 'rec-1',
  campaignId: 'camp-1',
  passId: 'pass-1',
  phone: '+15550001234',
  email: null,
  pushToken: null,
  variables: { firstName: 'Ana', organizationName: 'Café', passUrl: 'https://pass.io/t', passToken: 'tok' },
  status: 'pending',
  sentAt: null,
  error: null,
  createdAt: new Date().toISOString(),
}

function makeCampaignRepo(overrides: Partial<CampaignRepository> = {}): CampaignRepository {
  return {
    claimDueCampaigns: mock(async () => [CAMPAIGN]),
    findPendingRecipients: mock(async () => []),
    markRecipientSent: mock(async () => {}),
    markRecipientFailed: mock(async () => {}),
    markRecipientSkipped: mock(async () => {}),
    incrementStats: mock(async () => {}),
    updateStatus: mock(async () => {}),
    save: mock(async (c: Campaign) => c),
    update: mock(async (c: Campaign) => c),
    findById: mock(async () => null),
    findByOrg: mock(async () => ({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 })),
    saveRecipients: mock(async () => {}),
    updateTotalRecipients: mock(async () => {}),
    getCampaignStats: mock(async () => ({ sent: 0, failed: 0, skipped: 0 })),
    ...overrides,
  } as unknown as CampaignRepository
}

function makeSender(): CampaignSenderService {
  return {
    send: mock(async () => {}),
  } as unknown as CampaignSenderService
}

function makeBillingRepo(overrides: Partial<BillingRepository> = {}): BillingRepository {
  return {
    tryDeductSmsCredits: mock(async () => true),
    ...overrides,
  } as unknown as BillingRepository
}

describe('ProcessCampaignsUseCase', () => {
  it('does nothing when there are no due campaigns', async () => {
    const repo = makeCampaignRepo({ claimDueCampaigns: mock(async () => []) })
    const sender = makeSender()
    const billing = makeBillingRepo()
    const useCase = new ProcessCampaignsUseCase(repo, sender, billing)

    await useCase.run()

    expect(repo.findPendingRecipients).not.toHaveBeenCalled()
    expect(sender.send).not.toHaveBeenCalled()
  })

  it('sends SMS and marks recipient sent when credits are sufficient', async () => {
    let recipientCallCount = 0
    const repo = makeCampaignRepo({
      findPendingRecipients: mock(async () => {
        recipientCallCount++
        return recipientCallCount === 1 ? [RECIPIENT] : []
      }),
    })
    const sender = makeSender()
    const billing = makeBillingRepo()
    const useCase = new ProcessCampaignsUseCase(repo, sender, billing)

    await useCase.run()

    expect(billing.tryDeductSmsCredits).toHaveBeenCalled()
    expect(sender.send).toHaveBeenCalledTimes(1)
    expect(repo.markRecipientSent).toHaveBeenCalledWith('rec-1')
  })

  it('marks recipient failed and does NOT send when credits are insufficient', async () => {
    let recipientCallCount = 0
    const repo = makeCampaignRepo({
      findPendingRecipients: mock(async () => {
        recipientCallCount++
        return recipientCallCount === 1 ? [RECIPIENT] : []
      }),
    })
    const sender = makeSender()
    const billing = makeBillingRepo({
      tryDeductSmsCredits: mock(async () => false),  // no credits
    })
    const useCase = new ProcessCampaignsUseCase(repo, sender, billing)

    await useCase.run()

    expect(sender.send).not.toHaveBeenCalled()
    expect(repo.markRecipientFailed).toHaveBeenCalledWith('rec-1', 'insufficient_sms_credits')
  })

  it('skips recipient when phone is null for SMS channel', async () => {
    const noPhoneRecipient = { ...RECIPIENT, phone: null }
    let recipientCallCount = 0
    const repo = makeCampaignRepo({
      findPendingRecipients: mock(async () => {
        recipientCallCount++
        return recipientCallCount === 1 ? [noPhoneRecipient] : []
      }),
    })
    const sender = makeSender()
    const billing = makeBillingRepo()
    const useCase = new ProcessCampaignsUseCase(repo, sender, billing)

    await useCase.run()

    expect(sender.send).not.toHaveBeenCalled()
    expect(repo.markRecipientSkipped).toHaveBeenCalledWith('rec-1')
  })

  it('updates campaign status to sent when all recipients are processed', async () => {
    const repo = makeCampaignRepo({
      findPendingRecipients: mock(async () => []),  // no pending recipients
    })
    const sender = makeSender()
    const billing = makeBillingRepo()
    const useCase = new ProcessCampaignsUseCase(repo, sender, billing)

    await useCase.run()

    expect(repo.updateStatus).toHaveBeenCalledWith('camp-1', 'sent', expect.any(String))
  })
})
