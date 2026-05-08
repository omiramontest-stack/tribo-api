import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { authenticate, requireOrgContext } from '../middlewares/authenticate.js'
import type { CreateCampaignUseCase } from '../../application/campaign/useCases/CreateCampaignUseCase.js'
import type { PreviewAudienceUseCase } from '../../application/campaign/useCases/PreviewAudienceUseCase.js'
import type { ScheduleCampaignUseCase } from '../../application/campaign/useCases/ScheduleCampaignUseCase.js'
import type { CancelCampaignUseCase } from '../../application/campaign/useCases/CancelCampaignUseCase.js'
import type { GetCampaignsUseCase } from '../../application/campaign/useCases/GetCampaignsUseCase.js'
import type { GetCampaignByIdUseCase } from '../../application/campaign/useCases/GetCampaignByIdUseCase.js'
import type { GetCampaignStatsUseCase } from '../../application/campaign/useCases/GetCampaignStatsUseCase.js'
import { SEGMENT_TYPES } from '../../domain/campaign/entities/Segment.js'
import type { PlanGuard } from '../middlewares/checkPlan.js'

const channelSchema = z.enum(['sms', 'email', 'wallet_push'])

const CHANNEL_FEATURE_MAP = {
  sms: 'smsCampaigns',
  email: 'emailCampaigns',
} as const satisfies Partial<Record<z.infer<typeof channelSchema>, import('../middlewares/checkPlan.js').PlanFeature>>

const segmentSchema = z.object({
  type: z.enum(SEGMENT_TYPES),
  walletId: z.string().optional(),
  thresholdPercent: z.number().min(1).max(100).optional(),
  inactiveDays: z.number().int().positive().optional(),
  minBalance: z.number().positive().optional(),
  minEvents: z.number().int().positive().optional(),
  withinDays: z.number().int().positive().optional(),
})

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  channel: channelSchema,
  segment: segmentSchema,
  messageTemplate: z.string().min(1).max(320),
  walletId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
})

const scheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
})

const statusSchema = z.enum(['draft', 'scheduled', 'sending', 'sent', 'cancelled']).optional()

export function campaignRoutes(
  createCampaign: CreateCampaignUseCase,
  previewAudience: PreviewAudienceUseCase,
  scheduleCampaign: ScheduleCampaignUseCase,
  cancelCampaign: CancelCampaignUseCase,
  getCampaigns: GetCampaignsUseCase,
  getCampaignById: GetCampaignByIdUseCase,
  getCampaignStats: GetCampaignStatsUseCase,
  planGuard: PlanGuard,
) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', authenticate)
    app.addHook('preHandler', requireOrgContext)

    app.post('/campaigns', async (request, reply) => {
      const body = createSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const orgId = request.admin.organizationId!

      const requiredFeature = CHANNEL_FEATURE_MAP[body.data.channel as keyof typeof CHANNEL_FEATURE_MAP]
      if (requiredFeature) {
        const allowed = await planGuard.checkFeatureAllowed(orgId, requiredFeature)
        if (!allowed) return reply.code(403).send({ error: 'PLAN_UPGRADE_REQUIRED', message: `Your plan does not include ${body.data.channel} campaigns` })
      }

      const campaign = await createCampaign.run({
        ...body.data,
        organizationId: orgId,
        adminId: request.admin.adminId,
      })

      if (body.data.scheduledAt) {
        await scheduleCampaign.run({
          campaignId: campaign.id,
          scheduledAt: body.data.scheduledAt,
          organizationId: orgId,
          adminId: request.admin.adminId,
        })
        reply.code(201).send({ ...campaign, status: 'scheduled', scheduledAt: body.data.scheduledAt })
        return
      }

      reply.code(201).send(campaign)
    })

    app.post('/campaigns/preview-audience', async (request, reply) => {
      const body = z.object({
        segment: segmentSchema,
        channel: channelSchema.optional(),
        messageTemplate: z.string().optional(),
      }).safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })
      reply.send(await previewAudience.run({
        segment: body.data.segment,
        channel: body.data.channel,
        messageTemplate: body.data.messageTemplate,
        organizationId: request.admin.organizationId!,
        adminId: request.admin.adminId,
      }))
    })

    app.get('/campaigns', async (request, reply) => {
      const { page = '1', limit = '20', status: rawStatus } = request.query as { page?: string; limit?: string; status?: string }
      const status = statusSchema.safeParse(rawStatus)
      const result = await getCampaigns.run({
        organizationId: request.admin.organizationId!,
        adminId: request.admin.adminId,
        status: status.success ? status.data : undefined,
        pagination: { page: Number(page), limit: Number(limit) },
      })
      reply.send({ ...result, data: result.data.map(c => ({ ...c, audienceSize: c.totalRecipients })) })
    })

    app.get('/campaigns/:id', async (request, reply) => {
      const { id } = request.params as { id: string }
      reply.send(await getCampaignById.run({
        campaignId: id,
        organizationId: request.admin.organizationId!,
        adminId: request.admin.adminId,
      }))
    })

    app.post('/campaigns/:id/schedule', async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = scheduleSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })
      await scheduleCampaign.run({
        campaignId: id,
        scheduledAt: body.data.scheduledAt,
        organizationId: request.admin.organizationId!,
        adminId: request.admin.adminId,
      })
      reply.send({ ok: true })
    })

    app.delete('/campaigns/:id', async (request, reply) => {
      const { id } = request.params as { id: string }
      await cancelCampaign.run({
        campaignId: id,
        organizationId: request.admin.organizationId!,
        adminId: request.admin.adminId,
      })
      reply.code(204).send()
    })

    app.get('/campaigns/:id/stats', async (request, reply) => {
      const { id } = request.params as { id: string }
      const { windowDays } = request.query as { windowDays?: string }
      const parsedWindow = windowDays ? Number(windowDays) : undefined
      reply.send(await getCampaignStats.run({
        campaignId: id,
        organizationId: request.admin.organizationId!,
        adminId: request.admin.adminId,
        windowDays: parsedWindow && parsedWindow > 0 ? parsedWindow : undefined,
      }))
    })
  }
}
