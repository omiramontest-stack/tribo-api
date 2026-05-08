import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { GetOrgAnalyticsUseCase } from '../../application/analytics/useCases/GetOrgAnalyticsUseCase.js'
import type { GetWalletAnalyticsUseCase } from '../../application/analytics/useCases/GetWalletAnalyticsUseCase.js'
import { authenticate, requireOrgContext } from '../middlewares/authenticate.js'
import type { AnalyticsPeriod } from '../../domain/analytics/repository/AnalyticsRepository.js'
const periodSchema = z.enum(['7d', '30d', '90d', '1y']).default('30d')

const periodToDays: Record<AnalyticsPeriod, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }

export function analyticsRoutes(
  getOrgAnalytics: GetOrgAnalyticsUseCase,
  getWalletAnalytics: GetWalletAnalyticsUseCase,
) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', authenticate)
    app.addHook('preHandler', requireOrgContext)

    app.get('/organizations/:orgId/analytics', async (request, reply) => {
      const { orgId } = request.params as { orgId: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      const query = periodSchema.safeParse((request.query as { period?: string }).period)
      const period = query.success ? query.data : '30d'

      reply.send(await getOrgAnalytics.run({
        organizationId: orgId,
        adminId: request.admin.adminId,
        period,
      }))
    })

    app.get('/organizations/:orgId/wallets/:walletId/analytics', async (request, reply) => {
      const { orgId, walletId } = request.params as { orgId: string; walletId: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      const query = periodSchema.safeParse((request.query as { period?: string }).period)
      const period = query.success ? query.data : '30d'

      reply.send(await getWalletAnalytics.run({
        walletId,
        organizationId: orgId,
        adminId: request.admin.adminId,
        days: periodToDays[period],
      }))
    })
  }
}
