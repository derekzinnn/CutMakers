/**
 * Confere (e opcionalmente repara) entregas com versão duplicada.
 *
 * Por que existe: até a migration 20261019120000, `Delivery` não tinha
 * constraint em (orderId, version) e o service calculava `version = count + 1`
 * fora de transação. Duas entregas simultâneas gravavam a mesma versão. A
 * constraint passa a impedir isso, mas ela NÃO é criada se o banco já tiver
 * duplicatas — o `migrate deploy` falha.
 *
 * Rode antes de aplicar a migration:
 *   pnpm --filter @cutmakers/api deliveries:check   (só relatório)
 *   pnpm --filter @cutmakers/api deliveries:fix     (renumera)
 *
 * O reparo renumera as entregas do pedido afetado por ordem cronológica
 * (createdAt), que é o significado de "versão". Pedidos sem duplicata não são
 * tocados. As revisões apontam para `deliveryId`, não para o número, então a
 * renumeração não quebra o histórico de revisões.
 */
import { prisma } from '../src/lib/prisma'

const APPLY = process.argv.includes('--apply')

async function main() {
  const duplicadas = await prisma.delivery.groupBy({
    by: ['orderId', 'version'],
    _count: { _all: true },
    having: { version: { _count: { gt: 1 } } },
  })

  if (duplicadas.length === 0) {
    const total = await prisma.delivery.count()
    console.log(`Nenhuma versão duplicada em ${total} entrega(s). A migration pode ser aplicada.`)
    return
  }

  const pedidosAfetados = [...new Set(duplicadas.map((d) => d.orderId))]
  console.log(
    `${duplicadas.length} par(es) (orderId, version) duplicado(s), em ${pedidosAfetados.length} pedido(s).`,
  )
  console.log('Sem reparo, o CREATE UNIQUE INDEX da migration vai falhar.\n')

  for (const orderId of pedidosAfetados) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { title: true },
    })
    const entregas = await prisma.delivery.findMany({
      where: { orderId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, version: true, createdAt: true },
    })

    console.log(`Pedido ${orderId} — "${order?.title ?? '(removido)'}"`)
    entregas.forEach((e, i) => {
      const nova = i + 1
      const marca = e.version === nova ? ' ' : '→'
      console.log(
        `  ${marca} v${e.version}  ${e.createdAt.toISOString()}  ${e.id}` +
          (e.version === nova ? '' : `   vira v${nova}`),
      )
    })

    if (APPLY) {
      // Transação por pedido: a renumeração de um pedido é atômica. Como a
      // constraint ainda não existe neste ponto, passos intermediários podem
      // repetir versões sem erro.
      await prisma.$transaction(
        entregas.map((e, i) =>
          prisma.delivery.update({ where: { id: e.id }, data: { version: i + 1 } }),
        ),
      )
      console.log('  reparado\n')
    } else {
      console.log('')
    }
  }

  if (!APPLY) {
    console.log('Rode com --apply (deliveries:fix) para renumerar.')
  } else {
    console.log('Renumeração concluída. Rode deliveries:check para confirmar.')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
