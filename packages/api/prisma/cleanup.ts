import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Iniciando limpeza do banco de dados...\n')

  const [notifs, msgs, convs, deliveries, reviews, proposals, transactions, orderFiles, orders] =
    await prisma.$transaction([
      prisma.notification.deleteMany(),
      prisma.message.deleteMany(),
      prisma.conversation.deleteMany(),
      prisma.delivery.deleteMany(),
      prisma.review.deleteMany(),
      prisma.orderProposal.deleteMany(),
      prisma.transaction.deleteMany(),
      prisma.orderFile.deleteMany(),
      prisma.order.deleteMany(),
    ])

  // Reset editor stats
  await prisma.editorProfile.updateMany({
    data: { avgRating: 0, totalJobs: 0 },
  })

  console.log(`✅ Notificações removidas:  ${notifs.count}`)
  console.log(`✅ Mensagens removidas:      ${msgs.count}`)
  console.log(`✅ Conversas removidas:      ${convs.count}`)
  console.log(`✅ Entregas removidas:       ${deliveries.count}`)
  console.log(`✅ Avaliações removidas:     ${reviews.count}`)
  console.log(`✅ Propostas removidas:      ${proposals.count}`)
  console.log(`✅ Transações removidas:     ${transactions.count}`)
  console.log(`✅ Arquivos removidos:       ${orderFiles.count}`)
  console.log(`✅ Pedidos removidos:        ${orders.count}`)
  console.log('\n✅ Stats dos editors resetados (avgRating, totalJobs)')
  console.log('\n🎉 Banco limpo e pronto para o demo!')
}

main()
  .catch((e) => { console.error('❌ Erro:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
