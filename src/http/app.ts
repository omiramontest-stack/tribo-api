import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../infrastructure/database/prisma.js'
import { AppError } from '../application/common/AppError.js'

// Repositories
import { WalletPrismaRepository } from '../infrastructure/wallet/repository/WalletPrismaRepository.js'
import { WalletTierPrismaRepository } from '../infrastructure/wallet/repository/WalletTierPrismaRepository.js'
import { EffectiveWalletResolver } from '../application/wallet/services/EffectiveWalletResolver.js'
import { GeofencePrismaRepository } from '../infrastructure/wallet/repository/GeofencePrismaRepository.js'
import { PassPrismaRepository } from '../infrastructure/pass/repository/PassPrismaRepository.js'
import { PassDownloadTokenPrismaRepository } from '../infrastructure/pass/repository/PassDownloadTokenPrismaRepository.js'
import { AuthPrismaRepository } from '../infrastructure/auth/repository/AuthPrismaRepository.js'
import { SessionCodePrismaRepository } from '../infrastructure/auth/repository/SessionCodePrismaRepository.js'
import { OrganizationPrismaRepository } from '../infrastructure/organization/repository/OrganizationPrismaRepository.js'
import { InvitationPrismaRepository } from '../infrastructure/organization/repository/InvitationPrismaRepository.js'

// Use cases — auth
import { LoginUseCase } from '../application/auth/useCases/LoginUseCase.js'
import { RegisterUseCase } from '../application/auth/useCases/RegisterUseCase.js'
import { GoogleAuthUseCase } from '../application/auth/useCases/GoogleAuthUseCase.js'
import { CreateSessionCodeUseCase } from '../application/auth/useCases/CreateSessionCodeUseCase.js'
import { ExchangeSessionCodeUseCase } from '../application/auth/useCases/ExchangeSessionCodeUseCase.js'
import { OnboardingUseCase } from '../application/auth/useCases/OnboardingUseCase.js'
import { SendVerificationEmailUseCase } from '../application/auth/useCases/SendVerificationEmailUseCase.js'
import { VerifyEmailUseCase } from '../application/auth/useCases/VerifyEmailUseCase.js'
import { RequestEmailChangeUseCase } from '../application/auth/useCases/RequestEmailChangeUseCase.js'
import { ConfirmEmailChangeUseCase } from '../application/auth/useCases/ConfirmEmailChangeUseCase.js'
import { ChangePasswordUseCase } from '../application/auth/useCases/ChangePasswordUseCase.js'
import { RequestPasswordResetUseCase } from '../application/auth/useCases/RequestPasswordResetUseCase.js'
import { ResetPasswordUseCase } from '../application/auth/useCases/ResetPasswordUseCase.js'

// Use cases — organization
import { GetMyOrganizationsUseCase } from '../application/organization/useCases/GetMyOrganizationsUseCase.js'
import { GetMembersUseCase } from '../application/organization/useCases/GetMembersUseCase.js'
import { InviteUserUseCase } from '../application/organization/useCases/InviteUserUseCase.js'
import { GetInvitationUseCase } from '../application/organization/useCases/GetInvitationUseCase.js'
import { AcceptInvitationUseCase } from '../application/organization/useCases/AcceptInvitationUseCase.js'
import { UpdateOrganizationUseCase } from '../application/organization/useCases/UpdateOrganizationUseCase.js'
import { UpdateMemberRoleUseCase } from '../application/organization/useCases/UpdateMemberRoleUseCase.js'
import { RemoveMemberUseCase } from '../application/organization/useCases/RemoveMemberUseCase.js'
import { CreateOrganizationUseCase } from '../application/organization/useCases/CreateOrganizationUseCase.js'

// Use cases — wallet
import { CreateWalletUseCase } from '../application/wallet/useCases/CreateWalletUseCase.js'
import { GetWalletsUseCase } from '../application/wallet/useCases/GetWalletsUseCase.js'
import { GetWalletByIdUseCase } from '../application/wallet/useCases/GetWalletByIdUseCase.js'
import { DeleteWalletUseCase } from '../application/wallet/useCases/DeleteWalletUseCase.js'
import { UpdateWalletUseCase } from '../application/wallet/useCases/UpdateWalletUseCase.js'
import { GetGeofencesUseCase } from '../application/wallet/useCases/GetGeofencesUseCase.js'
import { CreateGeofenceUseCase } from '../application/wallet/useCases/CreateGeofenceUseCase.js'
import { UpdateGeofenceUseCase } from '../application/wallet/useCases/UpdateGeofenceUseCase.js'
import { DeleteGeofenceUseCase } from '../application/wallet/useCases/DeleteGeofenceUseCase.js'
import { ListWalletTiersUseCase } from '../application/wallet/useCases/ListWalletTiersUseCase.js'
import { CreateWalletTierUseCase } from '../application/wallet/useCases/CreateWalletTierUseCase.js'
import { UpdateWalletTierUseCase } from '../application/wallet/useCases/UpdateWalletTierUseCase.js'
import { DeleteWalletTierUseCase } from '../application/wallet/useCases/DeleteWalletTierUseCase.js'

// Use cases — pass
import { GeneratePassUseCase } from '../application/pass/useCases/GeneratePassUseCase.js'
import { GetPassByTokenUseCase } from '../application/pass/useCases/GetPassByTokenUseCase.js'
import { GetPassesByWalletUseCase } from '../application/pass/useCases/GetPassesByWalletUseCase.js'
import { UpdatePassDataUseCase } from '../application/pass/useCases/UpdatePassDataUseCase.js'
import { DeletePassUseCase } from '../application/pass/useCases/DeletePassUseCase.js'
import { ScanDaypassUseCase } from '../application/pass/useCases/ScanDaypassUseCase.js'
import { GetScannedDaypassesUseCase } from '../application/pass/useCases/GetScannedDaypassesUseCase.js'
import { SendPassLinkUseCase } from '../application/pass/useCases/SendPassLinkUseCase.js'
import { SendPassWhatsAppUseCase } from '../application/pass/useCases/SendPassWhatsAppUseCase.js'
import { RenewPassUseCase } from '../application/pass/useCases/RenewPassUseCase.js'
import { UnarchivePassUseCase } from '../application/pass/useCases/UnarchivePassUseCase.js'
import { WhatsAppSessionManager } from '../infrastructure/whatsapp/WhatsAppSessionManager.js'
import { WhatsAppCleanupWorker } from '../infrastructure/whatsapp/WhatsAppCleanupWorker.js'
import { SseTokenStore } from '../infrastructure/whatsapp/SseTokenStore.js'
import { whatsappRoutes } from './routes/whatsapp.routes.js'
import { RedeemDownloadTokenUseCase } from '../application/pass/useCases/RedeemDownloadTokenUseCase.js'
import { ValidateDownloadTokenUseCase } from '../application/pass/useCases/ValidateDownloadTokenUseCase.js'

// Use cases — cashback
import { GetCashbackTransactionsUseCase } from '../application/cashback/useCases/GetCashbackTransactionsUseCase.js'

// Repositories — cashback
import { CashbackTransactionPrismaRepository } from '../infrastructure/cashback/repository/CashbackTransactionPrismaRepository.js'

// Repositories — analytics
import { PassEventPrismaRepository } from '../infrastructure/analytics/repository/PassEventPrismaRepository.js'
import { AnalyticsPrismaRepository } from '../infrastructure/analytics/repository/AnalyticsPrismaRepository.js'

// Use cases — analytics
import { GetOrgAnalyticsUseCase } from '../application/analytics/useCases/GetOrgAnalyticsUseCase.js'
import { GetWalletAnalyticsUseCase } from '../application/analytics/useCases/GetWalletAnalyticsUseCase.js'

// Campaign — repositories, services, senders, use cases, worker, routes
import { CampaignPrismaRepository } from '../infrastructure/campaign/repository/CampaignPrismaRepository.js'
import { SegmentResolverService } from '../application/campaign/services/SegmentResolverService.js'
import { CampaignSenderService } from '../application/campaign/services/CampaignSenderService.js'
import { SmsSender } from '../infrastructure/campaign/senders/SmsSender.js'
import { EmailSender } from '../infrastructure/campaign/senders/EmailSender.js'
import { WalletPushSender } from '../infrastructure/campaign/senders/WalletPushSender.js'
import { CreateCampaignUseCase } from '../application/campaign/useCases/CreateCampaignUseCase.js'
import { PreviewAudienceUseCase } from '../application/campaign/useCases/PreviewAudienceUseCase.js'
import { ScheduleCampaignUseCase } from '../application/campaign/useCases/ScheduleCampaignUseCase.js'
import { CancelCampaignUseCase } from '../application/campaign/useCases/CancelCampaignUseCase.js'
import { GetCampaignsUseCase } from '../application/campaign/useCases/GetCampaignsUseCase.js'
import { GetCampaignByIdUseCase } from '../application/campaign/useCases/GetCampaignByIdUseCase.js'
import { GetCampaignStatsUseCase } from '../application/campaign/useCases/GetCampaignStatsUseCase.js'
import { ProcessCampaignsUseCase } from '../application/campaign/useCases/ProcessCampaignsUseCase.js'
import { CampaignWorker, type IWorker } from '../infrastructure/campaign/worker/CampaignWorker.js'
import { GeofenceWorker } from '../infrastructure/wallet/worker/GeofenceWorker.js'
import { campaignRoutes } from './routes/campaign.routes.js'

// Billing
import { BillingPrismaRepository } from '../infrastructure/billing/repository/BillingPrismaRepository.js'
import { StripeService } from '../infrastructure/billing/stripe/StripeService.js'
import { CreateTrialUseCase } from '../application/billing/useCases/CreateTrialUseCase.js'
import { GetBillingStatusUseCase } from '../application/billing/useCases/GetBillingStatusUseCase.js'
import { CreateCheckoutSessionUseCase } from '../application/billing/useCases/CreateCheckoutSessionUseCase.js'
import { BuyCreditsUseCase } from '../application/billing/useCases/BuyCreditsUseCase.js'
import { HandleStripeWebhookUseCase } from '../application/billing/useCases/HandleStripeWebhookUseCase.js'
import { billingRoutes } from './routes/billing.routes.js'
import { createPlanGuard } from './middlewares/checkPlan.js'

// Plugins & routes
import cookiesPlugin from './plugins/cookies.js'
import corsPlugin from './plugins/cors.js'
import rateLimitPlugin from './plugins/rateLimit.js'
import securityPlugin from './plugins/security.js'
import traceIdPlugin from './plugins/traceId.js'
import { authRoutes } from './routes/auth.routes.js'
import { organizationRoutes } from './routes/organization.routes.js'
import { walletRoutes } from './routes/wallet.routes.js'
import { geofenceRoutes } from './routes/geofence.routes.js'
import { walletTierRoutes } from './routes/walletTier.routes.js'
import { passRoutes } from './routes/pass.routes.js'
import { appleRoutes } from './routes/apple.routes.js'
import { analyticsRoutes } from './routes/analytics.routes.js'

export async function buildApp(): Promise<{ app: FastifyInstance; worker: IWorker; whatsappManager: WhatsAppSessionManager; whatsappCleanup: WhatsAppCleanupWorker }> {
  const app = Fastify({ logger: true })

  await app.register(securityPlugin)
  await app.register(traceIdPlugin)
  await app.register(cookiesPlugin)
  await app.register(corsPlugin)
  await app.register(rateLimitPlugin)

  // Repositories
  const walletRepo = new WalletPrismaRepository(prisma)
  const walletTierRepo = new WalletTierPrismaRepository(prisma)
  const effectiveWalletResolver = new EffectiveWalletResolver(walletTierRepo)
  const geofenceRepo = new GeofencePrismaRepository(prisma)
  const passRepo = new PassPrismaRepository(prisma)
  const passDownloadTokenRepo = new PassDownloadTokenPrismaRepository(prisma)
  const authRepo = new AuthPrismaRepository(prisma)
  const orgRepo = new OrganizationPrismaRepository(prisma)
  const invitationRepo = new InvitationPrismaRepository(prisma)
  const cashbackTransactionRepo = new CashbackTransactionPrismaRepository(prisma)
  const passEventRepo = new PassEventPrismaRepository(prisma)
  const analyticsRepo = new AnalyticsPrismaRepository(prisma)
  const billingRepo = new BillingPrismaRepository(prisma)

  const createTrial = new CreateTrialUseCase(billingRepo, orgRepo)

  // Auth use cases
  const sessionCodeRepo = new SessionCodePrismaRepository(prisma)
  const loginUseCase = new LoginUseCase(authRepo)
  const registerUseCase = new RegisterUseCase(authRepo)
  const googleAuthUseCase = new GoogleAuthUseCase(authRepo)
  const createSessionCode = new CreateSessionCodeUseCase(sessionCodeRepo)
  const exchangeSessionCode = new ExchangeSessionCodeUseCase(sessionCodeRepo, authRepo)
  const onboardingUseCase = new OnboardingUseCase(orgRepo, billingRepo, createTrial)
  const sendVerificationEmail = new SendVerificationEmailUseCase(authRepo)
  const verifyEmail = new VerifyEmailUseCase(authRepo)
  const requestEmailChange = new RequestEmailChangeUseCase(authRepo)
  const confirmEmailChange = new ConfirmEmailChangeUseCase(authRepo)
  const changePassword = new ChangePasswordUseCase(authRepo)
  const requestPasswordReset = new RequestPasswordResetUseCase(authRepo)
  const resetPassword = new ResetPasswordUseCase(authRepo)

  // Organization use cases
  const getMyOrganizations = new GetMyOrganizationsUseCase(orgRepo)
  const getMembers = new GetMembersUseCase(orgRepo)
  const inviteUser = new InviteUserUseCase(orgRepo, invitationRepo)
  const getInvitation = new GetInvitationUseCase(invitationRepo, orgRepo)
  const acceptInvitation = new AcceptInvitationUseCase(invitationRepo, orgRepo, authRepo, getInvitation)
  const updateOrganization = new UpdateOrganizationUseCase(orgRepo)
  const updateMemberRole = new UpdateMemberRoleUseCase(orgRepo)
  const removeMember = new RemoveMemberUseCase(orgRepo)
  const createOrganization = new CreateOrganizationUseCase(orgRepo, billingRepo)

  // Wallet use cases
  const createWallet = new CreateWalletUseCase(walletRepo, orgRepo)
  const getWallets = new GetWalletsUseCase(walletRepo, orgRepo)
  const getWalletById = new GetWalletByIdUseCase(walletRepo, orgRepo)
  const deleteWallet = new DeleteWalletUseCase(walletRepo, passRepo, orgRepo)
  const updateWallet = new UpdateWalletUseCase(walletRepo, walletTierRepo, passRepo, orgRepo)

  // Geofence use cases
  const getGeofences = new GetGeofencesUseCase(geofenceRepo, walletRepo, orgRepo)
  const createGeofence = new CreateGeofenceUseCase(geofenceRepo, walletRepo, passRepo, orgRepo)
  const updateGeofence = new UpdateGeofenceUseCase(geofenceRepo, walletRepo, passRepo, orgRepo)
  const deleteGeofence = new DeleteGeofenceUseCase(geofenceRepo, walletRepo, passRepo, orgRepo)

  const listWalletTiers = new ListWalletTiersUseCase(walletTierRepo, walletRepo, orgRepo)
  const createWalletTier = new CreateWalletTierUseCase(walletTierRepo, walletRepo, orgRepo)
  const updateWalletTier = new UpdateWalletTierUseCase(walletTierRepo, walletRepo, orgRepo)
  const deleteWalletTier = new DeleteWalletTierUseCase(walletTierRepo, walletRepo, orgRepo)

  // Pass use cases
  const generatePass = new GeneratePassUseCase(walletRepo, passRepo, orgRepo, passEventRepo)
  const getPassByToken = new GetPassByTokenUseCase(walletRepo, passRepo, effectiveWalletResolver)
  const getPassesByWallet = new GetPassesByWalletUseCase(passRepo, walletRepo, orgRepo)
  const updatePassData = new UpdatePassDataUseCase(walletRepo, passRepo, orgRepo, cashbackTransactionRepo, passEventRepo, effectiveWalletResolver)
  const deletePass = new DeletePassUseCase(passRepo, walletRepo, orgRepo, passEventRepo)
  const scanDaypass = new ScanDaypassUseCase(passRepo, walletRepo, passEventRepo)
  const getScannedDaypasses = new GetScannedDaypassesUseCase(passRepo, walletRepo, orgRepo)
  const sendPassLink = new SendPassLinkUseCase(passRepo, walletRepo, orgRepo, passEventRepo, passDownloadTokenRepo)
  const renewPass = new RenewPassUseCase(walletRepo, walletTierRepo, passRepo, orgRepo, passEventRepo)
  const unarchivePass = new UnarchivePassUseCase(passRepo, walletRepo, orgRepo)
  const whatsappManager = new WhatsAppSessionManager(prisma)
  const whatsappCleanup = new WhatsAppCleanupWorker(prisma)
  const sseTokenStore = new SseTokenStore()
  const sendPassWhatsApp = new SendPassWhatsAppUseCase(passRepo, walletRepo, orgRepo, passEventRepo, passDownloadTokenRepo, whatsappManager)
  const redeemDownloadToken = new RedeemDownloadTokenUseCase(passDownloadTokenRepo)
  const validateDownloadToken = new ValidateDownloadTokenUseCase(passDownloadTokenRepo)

  // Cashback use cases
  const getCashbackTransactions = new GetCashbackTransactionsUseCase(passRepo, walletRepo, orgRepo, cashbackTransactionRepo)

  // Analytics use cases
  const getOrgAnalytics = new GetOrgAnalyticsUseCase(analyticsRepo, orgRepo, walletTierRepo)
  const getWalletAnalytics = new GetWalletAnalyticsUseCase(analyticsRepo, walletRepo, walletTierRepo, orgRepo)

  // Campaign
  const campaignRepo = new CampaignPrismaRepository(prisma)
  const segmentResolver = new SegmentResolverService(prisma)
  const senderMap = new Map([
    ['sms', new SmsSender()],
    ['email', new EmailSender()],
    ['wallet_push', new WalletPushSender(prisma)],
  ] as const)
  const campaignSender = new CampaignSenderService(senderMap)
  const createCampaign = new CreateCampaignUseCase(campaignRepo, orgRepo, walletRepo)
  const previewAudience = new PreviewAudienceUseCase(orgRepo, segmentResolver, billingRepo)
  const scheduleCampaign = new ScheduleCampaignUseCase(campaignRepo, orgRepo, walletRepo, passRepo, segmentResolver)
  const cancelCampaign = new CancelCampaignUseCase(campaignRepo, orgRepo)
  const getCampaigns = new GetCampaignsUseCase(campaignRepo, orgRepo)
  const getCampaignById = new GetCampaignByIdUseCase(campaignRepo, orgRepo)
  const getCampaignStats = new GetCampaignStatsUseCase(campaignRepo, orgRepo)
  const processCampaigns = new ProcessCampaignsUseCase(campaignRepo, campaignSender, billingRepo)
  const worker = new CampaignWorker(processCampaigns)
  const geofenceWorker = new GeofenceWorker(geofenceRepo, walletRepo, passRepo, prisma)
  geofenceWorker.start()

  // Billing
  const stripeService = new StripeService()
  const getBillingStatus = new GetBillingStatusUseCase(billingRepo)
  const createCheckout = new CreateCheckoutSessionUseCase(billingRepo, stripeService)
  const buyCredits = new BuyCreditsUseCase(billingRepo, stripeService)
  const handleWebhook = new HandleStripeWebhookUseCase(billingRepo, stripeService)
  const planGuard = createPlanGuard(billingRepo)

  // Routes
  app.register(authRoutes(loginUseCase, registerUseCase, googleAuthUseCase, onboardingUseCase, orgRepo, sendVerificationEmail, verifyEmail, requestEmailChange, confirmEmailChange, changePassword, requestPasswordReset, resetPassword, authRepo, createSessionCode, exchangeSessionCode))
  app.register(organizationRoutes(getMyOrganizations, getMembers, inviteUser, getInvitation, acceptInvitation, updateOrganization, updateMemberRole, removeMember, createOrganization))
  app.register(walletRoutes(createWallet, getWallets, getWalletById, deleteWallet, updateWallet, walletRepo, planGuard))
  app.register(geofenceRoutes(getGeofences, createGeofence, updateGeofence, deleteGeofence))
  app.register(walletTierRoutes(listWalletTiers, createWalletTier, updateWalletTier, deleteWalletTier))
  app.register(passRoutes(generatePass, getPassByToken, getPassesByWallet, updatePassData, deletePass, scanDaypass, getCashbackTransactions, getScannedDaypasses, sendPassLink, validateDownloadToken, passRepo, planGuard, sendPassWhatsApp, renewPass, unarchivePass))
  app.register(whatsappRoutes(whatsappManager, orgRepo, sseTokenStore))
  app.register(appleRoutes(prisma, passRepo, walletRepo, geofenceRepo, validateDownloadToken, redeemDownloadToken, effectiveWalletResolver))
  app.register(analyticsRoutes(getOrgAnalytics, getWalletAnalytics))
  app.register(campaignRoutes(createCampaign, previewAudience, scheduleCampaign, cancelCampaign, getCampaigns, getCampaignById, getCampaignStats, planGuard))
  app.register(billingRoutes(getBillingStatus, createCheckout, buyCredits, handleWebhook, billingRepo, stripeService))

  // ── Health check ──────────────────────────────────────────────────────────
  // Usado por load balancers / Kubernetes para liveness y readiness probes.
  // Ejecuta SELECT 1 para confirmar que la DB está accesible.
  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      reply.code(200).send({ status: 'ok', uptime: process.uptime(), db: 'ok' })
    } catch {
      reply.code(503).send({ status: 'error', uptime: process.uptime(), db: 'unreachable' })
    }
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.code, message: error.message })
    }
    const err = error as { statusCode?: number; code?: string; message?: string }
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.code ?? 'ERROR', message: err.message })
    }
    app.log.error(error)
    reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' })
  })

  return { app, worker, whatsappManager, whatsappCleanup }
}
