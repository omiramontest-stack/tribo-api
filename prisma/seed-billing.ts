import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── Plans ────────────────────────────────────────────────────────────────
  await prisma.plan.upsert({
    where: { slug: 'trial' },
    update: {
      name: 'Prueba gratuita',
      price: 0,
      stripePriceId: null,
      maxWallets: 3,
      maxPasses: 10,
      emailCampaigns: false,
      smsCampaigns: false,
      analyticsLevel: 'basic',
      isActive: true,
    },
    create: {
      slug: 'trial',
      name: 'Prueba gratuita',
      price: 0,
      currency: 'MXN',
      stripePriceId: null,
      maxWallets: 3,
      maxPasses: 10,
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
      stripePriceId: 'price_1TTSDXAPwkRIj7DiJp1eH90u',
      maxWallets: 6,
      maxPasses: null,
      emailCampaigns: true,
      smsCampaigns: true,
      analyticsLevel: 'basic',
      isActive: true,
    },
    create: {
      slug: 'base',
      name: 'Base',
      price: 149,
      currency: 'MXN',
      stripePriceId: 'price_1TTSDXAPwkRIj7DiJp1eH90u',
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
      stripePriceId: 'price_1TTSHkAPwkRIj7DiTwkZgwY2',
      maxWallets: 30,
      maxPasses: null,
      emailCampaigns: true,
      smsCampaigns: true,
      analyticsLevel: 'full',
      isActive: true,
    },
    create: {
      slug: 'pro',
      name: 'Pro',
      price: 399,
      currency: 'MXN',
      stripePriceId: 'price_1TTSHkAPwkRIj7DiTwkZgwY2',
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
    { name: 'Básico',  price: 135, credits: 150,  priceId: 'price_1TTSOtAPwkRIj7DihuD5EDUZ' },
    { name: 'Popular', price: 349, credits: 400,  priceId: 'price_1TTSQnAPwkRIj7DiK2ccwEnI' },
    { name: 'Grande',  price: 829, credits: 1000, priceId: 'price_1TTSTfAPwkRIj7DiQdbzco0x' },
    { name: 'Prueba',  price: 49,  credits: 50,   priceId: 'price_1TTSOtAPwkRIj7DihuD5EDUZ' },
  ]

  for (const pack of packs) {
    const existing = await prisma.smsCreditPack.findFirst({ where: { name: pack.name } })
    if (existing) {
      await prisma.smsCreditPack.update({
        where: { id: existing.id },
        data: { price: pack.price, credits: pack.credits, stripePriceId: pack.priceId },
      })
    } else {
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
