/**
 * Tests — Onboarding / Google OAuth flow (Fix-22 / Flow 5)
 *
 * Tests the critical invariants of OnboardingUseCase:
 *   - New user → creates org + member + trial subscription atomically
 *   - Existing org with subscription → throws ALREADY_ONBOARDED
 *   - Existing org without subscription (orphaned) → creates trial only
 *   - Missing trial plan config → throws PLAN_NOT_FOUND
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { OnboardingUseCase } from '../application/auth/useCases/OnboardingUseCase.js'
import { AppError } from '../application/common/AppError.js'
import type { OrganizationRepository } from '../domain/organization/repository/OrganizationRepository.js'
import type { BillingRepository } from '../domain/billing/repository/BillingRepository.js'
import type { CreateTrialUseCase } from '../application/billing/useCases/CreateTrialUseCase.js'
import type { Organization } from '../domain/organization/entities/Organization.js'
import type { OrganizationMember } from '../domain/organization/entities/OrganizationMember.js'
import type { Plan } from '../domain/billing/entities/Plan.js'
import type { Subscription } from '../domain/billing/entities/Subscription.js'
import type { CreateOrgWithMemberAndSubscriptionParams } from '../domain/organization/repository/OrganizationRepository.js'

const EXISTING_ORG: Organization = {
  id: 'org-existing',
  name: 'Existing Corp',
  logoUrl: null,
  industry: null,
  country: null,
  phone: null,
  whatsappMessageTemplate: null,
  createdAt: new Date().toISOString(),
}

const TRIAL_PLAN: Plan = {
  id: 'plan-trial',
  slug: 'trial',
  name: 'Trial',
  price: 0,
  currency: 'USD',
  stripePriceId: null,
  maxWallets: 1,
  maxPasses: 100,
  emailCampaigns: false,
  smsCampaigns: false,
  analyticsLevel: 'basic',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const ACTIVE_SUB: Subscription = {
  id: 'sub-1',
  organizationId: 'org-existing',
  planId: 'plan-trial',
  status: 'active',
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
  trialEndsAt: null,
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 14 * 86400000).toISOString(),
  cancelledAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeOrgRepo(overrides: Partial<OrganizationRepository> = {}): OrganizationRepository {
  return {
    findByAdminId: mock(async () => []),
    createWithMemberAndSubscription: mock(async (p: CreateOrgWithMemberAndSubscriptionParams) => ({
      id: p.orgId,
      name: p.name,
      logoUrl: p.logoUrl,
      industry: p.industry,
      country: p.country,
      phone: p.phone,
      whatsappMessageTemplate: null,
      createdAt: new Date().toISOString(),
    })),
    save: mock(async (o: Organization) => o),
    update: mock(async (_id: string, _data: Partial<Organization>) => EXISTING_ORG),
    findById: mock(async () => null),
    addMember: mock(async (m: OrganizationMember) => m),
    findMembers: mock(async () => []),
    findMemberById: mock(async () => null),
    isMember: mock(async () => false),
    getMemberRole: mock(async () => null),
    isEmailAlreadyMember: mock(async () => false),
    updateMemberRole: mock(async (_id: string, _role: string) => ({ id: '', organizationId: '', adminId: '', role: 'member' as const, email: '', createdAt: '' })),
    removeMember: mock(async () => {}),
    ...overrides,
  } as unknown as OrganizationRepository
}

function makeBillingRepo(overrides: Partial<BillingRepository> = {}): BillingRepository {
  return {
    findSubscriptionByOrg: mock(async () => null),
    findPlanBySlug: mock(async () => TRIAL_PLAN),
    ...overrides,
  } as unknown as BillingRepository
}

function makeCreateTrial(): CreateTrialUseCase {
  return {
    run: mock(async () => {}),
  } as unknown as CreateTrialUseCase
}

describe('OnboardingUseCase', () => {
  it('creates org + member + trial subscription for new user', async () => {
    const orgRepo = makeOrgRepo()
    const billingRepo = makeBillingRepo()
    const createTrial = makeCreateTrial()
    const useCase = new OnboardingUseCase(orgRepo, billingRepo, createTrial)

    const result = await useCase.run({
      adminId: 'admin-new',
      organizationName: 'New Coffee Co',
      industry: 'F&B',
    })

    expect(orgRepo.createWithMemberAndSubscription).toHaveBeenCalledTimes(1)
    const params = (orgRepo.createWithMemberAndSubscription as ReturnType<typeof mock>).mock.calls[0][0]
    expect(params.name).toBe('New Coffee Co')
    expect(params.adminId).toBe('admin-new')
    expect(params.planId).toBe('plan-trial')
    expect(result.name).toBe('New Coffee Co')
  })

  it('throws ALREADY_ONBOARDED when org + subscription already exist', async () => {
    const orgRepo = makeOrgRepo({
      findByAdminId: mock(async () => [EXISTING_ORG]),
    })
    const billingRepo = makeBillingRepo({
      findSubscriptionByOrg: mock(async () => ACTIVE_SUB),
    })
    const createTrial = makeCreateTrial()
    const useCase = new OnboardingUseCase(orgRepo, billingRepo, createTrial)

    await expect(useCase.run({ adminId: 'admin-existing', organizationName: 'Anything' }))
      .rejects.toMatchObject({ code: 'ALREADY_ONBOARDED', statusCode: 409 })
  })

  it('creates trial for orphaned org (org exists but no subscription)', async () => {
    const orgRepo = makeOrgRepo({
      findByAdminId: mock(async () => [EXISTING_ORG]),
    })
    const billingRepo = makeBillingRepo({
      findSubscriptionByOrg: mock(async () => null),  // no sub
    })
    const createTrial = makeCreateTrial()
    const useCase = new OnboardingUseCase(orgRepo, billingRepo, createTrial)

    const result = await useCase.run({ adminId: 'admin-orphan', organizationName: 'Orphaned Org' })

    expect(createTrial.run).toHaveBeenCalledWith('org-existing')
    expect(result.id).toBe('org-existing')
  })

  it('throws PLAN_NOT_FOUND when trial plan is not configured', async () => {
    const orgRepo = makeOrgRepo()
    const billingRepo = makeBillingRepo({
      findPlanBySlug: mock(async () => null),
    })
    const createTrial = makeCreateTrial()
    const useCase = new OnboardingUseCase(orgRepo, billingRepo, createTrial)

    await expect(useCase.run({ adminId: 'admin-new', organizationName: 'Test' }))
      .rejects.toMatchObject({ code: 'PLAN_NOT_FOUND', statusCode: 500 })
  })
})
