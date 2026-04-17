import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.admin.findUnique({ where: { email: 'admin@wallet.com' } })
  if (existing) {
    console.log('Seed already applied.')
    return
  }

  await prisma.admin.create({
    data: {
      email: 'admin@wallet.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      businessName: 'Wallet SaaS',
    },
  })

  console.log('Admin seeded: admin@wallet.com / admin123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
