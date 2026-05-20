import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ─── Admin padrão ──────────────────────────────────────────────────────────
  const adminEmail = 'cutmakers@admin.com'
  const adminPassword = 'cutmakers@123'

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })

  if (existingAdmin) {
    console.log(`✓ Admin já existe (${adminEmail}) — pulando.`)
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    const admin = await prisma.user.create({
      data: {
        name: 'CutMakers Admin',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
      },
    })
    console.log(`✓ Admin criado: ${admin.email}`)
  }

  // ─── Categorias padrão ─────────────────────────────────────────────────────
  const categories = ['Reels', 'YouTube', 'TikTok', 'Podcast', 'Corporativo', 'Wedding']

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }
  console.log(`✓ ${categories.length} categorias garantidas no banco`)

  console.log('🌱 Seed concluído!')
}

main()
  .catch((err) => {
    console.error('❌ Erro no seed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
