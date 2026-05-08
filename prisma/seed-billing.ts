import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── Plans ────────────────────────────────────────────────────────────────
  await prisma.plan.upsert({
    where: { slug: 'trial' },
    update: {},
    create: {
      slug: 'trial',
      name: 'Trial',
      price: 0,
      currency: 'MXN',
      stripePriceId: null,
      maxWallets: 3,
      maxPasses: 30,
      emailCampaigns: false,
      smsCampaigns: false,
      analyticsLevel: 'basic',
      isActive: true,
    },
  })

  await prisma.plan.upsert({
    where: { slug: 'base' },
    update: {
      name: 'Base',
      price: 149,
      maxWallets: 6,
      maxPasses: null,
      emailCampaigns: true,
      smsCampaigns: true,
      analyticsLevel: 'basic',
    },
    create: {
      slug: 'base',
      name: 'Base',
      price: 149,
      currency: 'MXN',
      stripePriceId: process.env.STRIPE_PRICE_BASE ?? null,
      maxWallets: 6,
      maxPasses: null,
      emailCampaigns: true,
      smsCampaigns: true,
      analyticsLevel: 'basic',
      isActive: true,
    },
  })

  await prisma.plan.upsert({
    where: { slug: 'pro' },
    update: {
      name: 'Pro',
      price: 399,
      maxWallets: 30,
      maxPasses: null,
      emailCampaigns: true,
      smsCampaigns: true,
      analyticsLevel: 'full',
    },
    create: {
      slug: 'pro',
      name: 'Pro',
      price: 399,
      currency: 'MXN',
      stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
      maxWallets: 30,
      maxPasses: null,
      emailCampaigns: true,
      smsCampaigns: true,
      analyticsLevel: 'full',
      isActive: true,
    },
  })

  console.log('✅ Plans seeded')

  // ── SMS Credit Packs ─────────────────────────────────────────────────────
  const packs = [
    { name: 'Básico', price: 99, credits: 150, priceId: process.env.STRIPE_PRICE_SMS_BASIC ?? null },
    { name: 'Popular', price: 249, credits: 500, priceId: process.env.STRIPE_PRICE_SMS_POPULAR ?? null },
    { name: 'Grande', price: 499, credits: 1200, priceId: process.env.STRIPE_PRICE_SMS_LARGE ?? null },
  ]

  for (const pack of packs) {
    const existing = await prisma.smsCreditPack.findFirst({ where: { name: pack.name } })
    if (!existing) {
      await prisma.smsCreditPack.create({
        data: {
          name: pack.name,
          price: pack.price,
          currency: 'MXN',
          credits: pack.credits,
          stripePriceId: pack.priceId,
          isActive: true,
        },
      })
    }
  }

  console.log('✅ SMS Credit Packs seeded')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
