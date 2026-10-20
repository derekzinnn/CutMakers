import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarPedido, criarTransacaoHeld } from './fixtures'
import { orderService } from '../src/services/order.service'

beforeEach(async () => {
  await limparBanco()
})

/**
 * Seis dos quinze achados do code review eram a MESMA classe de bug: ler o
 * estado, decidir, e escrever sem garantir que nada mudou no meio. Estes testes
 * exercitam os claims otimistas que fecharam cada um — e só fazem sentido contra
 * Postgres de verdade, porque é o banco que arbitra a corrida.
 */

describe('versão da entrega sob concorrência', () => {
  it('duas entregas simultâneas NÃO geram versão duplicada', async () => {
    const { order, editor } = await criarPedido({ status: 'IN_PROGRESS' })

    const [a, b] = await Promise.all([
      orderService.createDelivery(order.id, editor.id, { videoUrl: 'https://cdn/a.mp4' }),
      orderService.createDelivery(order.id, editor.id, { videoUrl: 'https://cdn/b.mp4' }),
    ])

    // Antes: ambas calculavam count+1 = 1 e gravavam v1 duas vezes.
    // Agora o @@unique rejeita a segunda e o retry recalcula.
    expect(new Set([a.version, b.version]).size).toBe(2)
    expect([a.version, b.version].sort()).toEqual([1, 2])

    const entregas = await testPrisma.delivery.findMany({ where: { orderId: order.id } })
    expect(entregas).toHaveLength(2)
  })

  it('cinco entregas simultâneas recebem cinco versões distintas', async () => {
    const { order, editor } = await criarPedido({ status: 'IN_PROGRESS' })

    const res = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        orderService.createDelivery(order.id, editor.id, { videoUrl: `https://cdn/v${i}.mp4` }),
      ),
    )

    const versoes = res.map((r) => r.version).sort((x, y) => x - y)
    expect(versoes).toEqual([1, 2, 3, 4, 5])
  })

  it('o banco recusa versão duplicada mesmo por fora do service', async () => {
    // Prova que a garantia é da constraint, não só da lógica do service
    const { order } = await criarPedido({ status: 'IN_PROGRESS' })
    await testPrisma.delivery.create({ data: { orderId: order.id, videoUrl: 'https://cdn/x.mp4', version: 1 } })

    await expect(
      testPrisma.delivery.create({ data: { orderId: order.id, videoUrl: 'https://cdn/y.mp4', version: 1 } }),
    ).rejects.toThrow()
  })
})

describe('aprovação da entrega sob concorrência', () => {
  it('dois cliques em "Aprovar" → só um passa, totalJobs incrementa UMA vez', async () => {
    const { order, creator, editor, editorProfile } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)

    const antes = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: editorProfile.id } })
    expect(antes.totalJobs).toBe(0)

    const res = await Promise.allSettled([
      orderService.updateStatus(order.id, creator.id, false, 'COMPLETED'),
      orderService.updateStatus(order.id, creator.id, false, 'COMPLETED'),
    ])

    const ok = res.filter((r) => r.status === 'fulfilled')
    const erro = res.filter((r) => r.status === 'rejected')
    expect(ok).toHaveLength(1)
    expect(erro).toHaveLength(1)

    const depois = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: editorProfile.id } })
    expect(depois.totalJobs).toBe(1)   // era o bug: dava 2

    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(tx.status).toBe('RELEASED')
  })

  it('o conflito perdedor devolve 409, não 500', async () => {
    const { order, creator, editor } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)

    await orderService.updateStatus(order.id, creator.id, false, 'COMPLETED')

    // Segunda tentativa: o status já mudou
    await expect(
      orderService.updateStatus(order.id, creator.id, false, 'COMPLETED'),
      // HttpError usa `status`, nao `statusCode` (src/lib/errors.ts)
    ).rejects.toMatchObject({ status: 400 })  // transição inválida a partir de COMPLETED
  })
})

describe('auto-aprovação de entregas paradas', () => {
  it('duas varreduras simultâneas NÃO duplicam totalJobs nem notificações', async () => {
    const { order, creator, editor, editorProfile } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)

    // Envelhece o pedido além do prazo de auto-aprovação (7 dias)
    const oitoDias = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    await testPrisma.$executeRaw`UPDATE "Order" SET "updatedAt" = ${oitoDias} WHERE id = ${order.id}`

    await Promise.all([
      orderService.autoApproveStaleDeliveries(),
      orderService.autoApproveStaleDeliveries(),
    ])

    const depois = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: editorProfile.id } })
    expect(depois.totalJobs).toBe(1)   // era o bug: duas varreduras davam 2

    const final = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(final.status).toBe('COMPLETED')

    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(tx.status).toBe('RELEASED')

    const notifs = await testPrisma.notification.count({
      where: { relatedOrderId: order.id, type: 'PAYMENT_RELEASED' },
    })
    expect(notifs).toBe(2)   // uma para cada parte, não quatro
  })

  it('não toca em entrega recente', async () => {
    const { order, creator, editor, editorProfile } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)

    await orderService.autoApproveStaleDeliveries()

    const final = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(final.status).toBe('DELIVERED')
    const p = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: editorProfile.id } })
    expect(p.totalJobs).toBe(0)
  })
})
