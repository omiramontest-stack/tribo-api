import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { CreateWalletUseCase } from '../../application/wallet/useCases/CreateWalletUseCase.js'
import type { GetWalletsUseCase } from '../../application/wallet/useCases/GetWalletsUseCase.js'
import type { GetWalletByIdUseCase } from '../../application/wallet/useCases/GetWalletByIdUseCase.js'
import type { DeleteWalletUseCase } from '../../application/wallet/useCases/DeleteWalletUseCase.js'
import type { UpdateWalletUseCase } from '../../application/wallet/useCases/UpdateWalletUseCase.js'
import type { WalletRepository } from '../../domain/wallet/repository/WalletRepository.js'
import type { StampIcon } from '../../domain/wallet/entities/WalletRules.js'
import { authenticate, requireOrgContext } from '../middlewares/authenticate.js'
import type { PlanGuard } from '../middlewares/checkPlan.js'

/** Catálogo completo de íconos de sello disponibles. */
export const STAMP_ICONS = [
  { id: 'check',    label: 'Check',        emoji: '✔️',  category: 'general'    },
  { id: 'star',     label: 'Estrella',     emoji: '⭐',  category: 'general'    },
  { id: 'heart',    label: 'Corazón',      emoji: '❤️',  category: 'general'    },
  { id: 'bolt',     label: 'Rayo',         emoji: '⚡',  category: 'general'    },
  { id: 'fire',     label: 'Fuego',        emoji: '🔥',  category: 'general'    },
  { id: 'crown',    label: 'Corona',       emoji: '👑',  category: 'general'    },
  { id: 'gem',      label: 'Gema',         emoji: '💎',  category: 'general'    },
  { id: 'gift',     label: 'Regalo',       emoji: '🎁',  category: 'general'    },
  { id: 'music',    label: 'Música',       emoji: '🎵',  category: 'general'    },
  { id: 'leaf',     label: 'Hoja',         emoji: '🍃',  category: 'general'    },
  { id: 'flower',   label: 'Flor',         emoji: '🌸',  category: 'general'    },
  { id: 'paw',      label: 'Huella',       emoji: '🐾',  category: 'mascotas'   },
  { id: 'coffee',   label: 'Café',         emoji: '☕',  category: 'alimentos'  },
  { id: 'pizza',    label: 'Pizza',        emoji: '🍕',  category: 'alimentos'  },
  { id: 'beer',     label: 'Cerveza',      emoji: '🍺',  category: 'alimentos'  },
  { id: 'burger',   label: 'Hamburguesa',  emoji: '🍔',  category: 'alimentos'  },
  { id: 'icecream', label: 'Helado',       emoji: '🍦',  category: 'alimentos'  },
  { id: 'custom',   label: 'Personalizado', emoji: '🎨', category: 'custom'     },
] as const

const stampIconIds = STAMP_ICONS.map(i => i.id) as [StampIcon, ...StampIcon[]]

export const rulesSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stamps'),
    totalStamps: z.number().int().min(1),
    reward: z.string(),
    stampIcon: z.enum(stampIconIds).optional(),
    stampCustomSvg: z.string().optional(),
    expiresInDays: z.number().int().positive().nullable(),
  }),
  z.object({ type: z.literal('membership'), level: z.string(), expiresInDays: z.number().int().positive().nullable() }),
  z.object({ type: z.literal('points'), pointsLabel: z.string(), reward: z.string(), rewardThreshold: z.number().int().min(1), expiresInDays: z.number().int().positive().nullable() }),
  z.object({ type: z.literal('cashback'), cashbackPercent: z.number().positive().max(100), currency: z.string().min(1), expiresInDays: z.number().int().positive().nullable() }),
  z.object({ type: z.literal('daypass'), eventName: z.string().min(1), eventDate: z.string().min(1), venue: z.string().min(1), imageUrl: z.string().url().nullable().optional().transform(v => v ?? null) }),
  z.object({ type: z.literal('bundle'), totalUses: z.number().int().min(1), label: z.string().min(1), expiresInDays: z.number().int().positive().nullable() }),
  z.object({ type: z.literal('giftcard'), initialBalance: z.number().positive(), currency: z.string().min(1), expiresInDays: z.number().int().positive().nullable() }),
  z.object({ type: z.literal('coupon'), discount: z.number().positive(), discountType: z.enum(['percent', 'fixed']), currency: z.string().optional(), expiresInDays: z.number().int().positive().nullable() }),
])

// Color hex de 6 dígitos — los del theme alimentan el render directamente (hexToRgb).
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color, e.g. #1A1A1A')

// Personalización visual del negocio. Todo opcional: lo no enviado cae al default
// (fondo = primaryColor, texto/label blanco, QR, fondo plano).
export const themeSchema = z.object({
  colors: z.object({
    background: hexColor.optional(),
    foreground: hexColor.optional(),
    label: hexColor.optional(),
    accent: hexColor.optional(),
    gradientTo: hexColor.nullable().optional(),
  }).optional(),
  typography: z.object({
    fontKey: z.enum(['system', 'rounded', 'serif', 'mono']).optional(),
  }).optional(),
  assets: z.object({
    logoUrl: z.string().url().nullable().optional(),
    stripImageUrl: z.string().url().nullable().optional(),
  }).optional(),
  barcode: z.object({
    format: z.enum(['qr', 'pdf417', 'code128']).optional(),
    altText: z.string().nullable().optional(),
  }).optional(),
  back: z.object({
    website: z.string().url().nullable().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    instagram: z.string().nullable().optional(),
  }).optional(),
})

const createSchema = z.object({
  type: z.enum(['stamps', 'membership', 'points', 'cashback', 'daypass', 'bundle', 'giftcard', 'coupon']),
  businessName: z.string().min(1),
  logoUrl: z.string().url().or(z.literal('')).nullable().optional(),
  primaryColor: z.string(),
  accentColor: z.string(),
  description: z.string(),
  rules: rulesSchema,
  businessRules: z.string().nullable().optional(),
  theme: themeSchema.nullable().optional(),
})

// Schema para edición parcial de wallet — todos los campos son opcionales
const updateSchema = z.object({
  businessName: z.string().min(1).optional(),
  logoUrl: z.string().url().or(z.literal('')).nullable().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  description: z.string().optional(),
  rules: rulesSchema.optional(),
  businessRules: z.string().nullable().optional(),
  theme: themeSchema.nullable().optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field must be provided' })

export function walletRoutes(
  createWallet: CreateWalletUseCase,
  getWallets: GetWalletsUseCase,
  getWalletById: GetWalletByIdUseCase,
  deleteWallet: DeleteWalletUseCase,
  updateWallet: UpdateWalletUseCase,
  walletRepo: WalletRepository,
  planGuard: PlanGuard,
) {
  return async (app: FastifyInstance) => {
    app.addHook('preHandler', authenticate)
    app.addHook('preHandler', requireOrgContext)

    app.get('/organizations/:orgId/wallets', async (request, reply) => {
      const { orgId } = request.params as { orgId: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })
      reply.send(await getWallets.run({ organizationId: request.admin.organizationId!, adminId: request.admin.adminId }))
    })

    app.get('/organizations/:orgId/wallets/:id', async (request, reply) => {
      const { orgId, id } = request.params as { orgId: string; id: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })
      reply.send(await getWalletById.run({ id, adminId: request.admin.adminId, organizationId: request.admin.organizationId! }))
    })

    app.post('/organizations/:orgId/wallets', async (request, reply) => {
      const { orgId } = request.params as { orgId: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      const body = createSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      const currentCount = await walletRepo.countByOrganizationId(request.admin.organizationId!)
      const { allowed, max } = await planGuard.checkWalletLimit(request.admin.organizationId!, currentCount)
      if (!allowed) {
        return reply.code(403).send({
          error: 'WALLET_LIMIT_REACHED',
          message: `Your plan allows up to ${max} wallet${max === 1 ? '' : 's'}`,
        })
      }

      reply.code(201).send(
        await createWallet.run({ ...body.data, organizationId: request.admin.organizationId!, adminId: request.admin.adminId }),
      )
    })

    app.put('/organizations/:orgId/wallets/:id', async (request, reply) => {
      const { orgId, id } = request.params as { orgId: string; id: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })

      const body = updateSchema.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: 'Invalid input', details: body.error.flatten() })

      reply.send(
        await updateWallet.run({
          id,
          organizationId: request.admin.organizationId!,
          adminId: request.admin.adminId,
          ...body.data,
        }),
      )
    })

    app.delete('/organizations/:orgId/wallets/:id', async (request, reply) => {
      const { orgId, id } = request.params as { orgId: string; id: string }
      if (orgId !== request.admin.organizationId) return reply.code(403).send({ error: 'Forbidden' })
      await deleteWallet.run({ id, adminId: request.admin.adminId, organizationId: request.admin.organizationId! })
      reply.code(204).send()
    })
  }
}
