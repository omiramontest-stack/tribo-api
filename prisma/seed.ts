import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const existing = await prisma.admin.findUnique({ where: { email: 'omiramontes@wallet.com' } })
  if (existing) {
    console.log('Seed already applied.')
    return
  }

  await prisma.admin.create({
    data: {
      email: 'omiramontes@wallet.com',
      passwordHash: await bcrypt.hash('admin1234', 10),
      businessName: 'Wallet SaaS Admin',
    },
  })

  console.log('Admin seeded: omiramontes@wallet.com / admin123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
