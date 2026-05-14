import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { GetMyOrganizationsUseCase } from '../../application/organization/useCases/GetMyOrganizationsUseCase.js'
import type { GetMembersUseCase } from '../../application/organization/useCases/GetMembersUseCase.js'
import type { InviteUserUseCase } from '../../application/organization/useCases/InviteUserUseCase.js'
import type { GetInvitationUseCase } from '../../application/organization/useCases/GetInvitationUseCase.js'
import type { AcceptInvitationUseCase } from '../../application/organization/useCases/AcceptInvitationUseCase.js'
import type { UpdateOrganizationUseCase } from '../../application/organization/useCases/UpdateOrganizationUseCase.js'
import type { UpdateMemberRoleUseCase } from '../../application/organization/useCases/UpdateMemberRoleUseCase.js'
import type { RemoveMemberUseCase } from '../../application/organization/useCases/RemoveMemberUseCase.js'
import { authenticate } from '../middlewares/authenticate.js'
import { signTokens, COOKIE_OPTS } from '../utils/tokens.js'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'staff']),
})

const acceptSchema = z.object({
  password: z.string().min(8),
})

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  whatsappMessageTemplate: z.string().max(500).nullable().optional(),
})

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'staff']),
})

export function organizationRoutes(
  getMyOrganizations: GetMyOrganizationsUseCase,
  getMembers: GetMembersUseCase,
  inviteUser: InviteUserUseCase,
  getInvitation: GetInvitationUseCase,
  acceptInvitation: AcceptInvitationUseCase,
  updateOrganization: UpdateOrganizationUseCase,
  updateMemberRole: UpdateMemberRoleUseCase,
  removeMember: RemoveMemberUseCase,
) {
  return async (app: FastifyInstance) => {
    app.get('/organizations', { preHandler: authenticate }, async (request, reply) => {
      reply.send(await getMyOrganizations.run(request.admin.adminId))
    })

    app.patch('/organizations/:id', { preHandler: authenticate }, async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = updateOrgSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const organization = await updateOrganization.run({ organizationId: id, requestingAdminId: request.admin.adminId, ...body.data })
      reply.send({ organization })
    })

    app.get('/organizations/:id/members', { preHandler: authenticate }, async (request, reply) => {
      const { id } = request.params as { id: string }
      reply.send(await getMembers.run({ organizationId: id, requestingAdminId: request.admin.adminId }))
    })

    app.patch('/organizations/:id/members/:memberId', { preHandler: authenticate }, async (request, reply) => {
      const { id, memberId } = request.params as { id: string; memberId: string }
      const body = updateMemberRoleSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const member = await updateMemberRole.run({ organizationId: id, requestingAdminId: request.admin.adminId, memberId, role: body.data.role })
      reply.send({ member })
    })

    app.delete('/organizations/:id/members/:memberId', { preHandler: authenticate }, async (request, reply) => {
      const { id, memberId } = request.params as { id: string; memberId: string }
      await removeMember.run({ organizationId: id, requestingAdminId: request.admin.adminId, memberId })
      reply.send({ ok: true })
    })

    app.post('/organizations/:id/invitations', { preHandler: authenticate }, async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = inviteSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      reply.code(201).send(
        await inviteUser.run({ organizationId: id, requestingAdminId: request.admin.adminId, ...body.data }),
      )
    })

    // Public invitation endpoints
    app.get('/invitations/:token', async (request, reply) => {
      const { token } = request.params as { token: string }
      const result = await getInvitation.run(token)
      reply.send({
        organization: { id: result.organization.id, name: result.organization.name },
        email: result.invitation.email,
        role: result.invitation.role,
        expiresAt: result.invitation.expiresAt,
      })
    })

    app.post('/invitations/:token/accept', async (request, reply) => {
      const { token } = request.params as { token: string }
      const body = acceptSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const admin = await acceptInvitation.run({ token, password: body.data.password })
      const { accessToken, refreshToken } = signTokens(admin.id, admin.email, undefined, admin.emailVerified)

      reply
        .setCookie('access_token', accessToken, { ...COOKIE_OPTS, maxAge: 60 * 15 })
        .setCookie('refresh_token', refreshToken, { ...COOKIE_OPTS, maxAge: 60 * 60 * 24 * 7 })
        .send({ admin, accessToken })
    })
  }
}
