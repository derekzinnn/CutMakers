import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarPedido, criarTransacaoHeld } from './fixtures'
import { deleteOrder } from '../src/services/order-delete.service'

/**
 * Exclusão definitiva de pedido (limpeza de dados de teste): apaga o pedido e todo o grafo que
 * depende dele, refaz a reputação do editor e se recusa a apagar pagamento REAL do gateway.
 */
beforeEach(async () => {
  await limparBanco()
})

const NODE_ENV_ORIGINAL = process.env.NODE_ENV
afterEach(() => {
  delete process.env.ALLOW_USER_DELETION
  process.env.NODE_ENV = NODE_ENV_ORIGINAL
})

async function criarAdmin() {
  return testPrisma.user.create({
    data: { name: 'Admin', email: `admin-${Date.now()}-${Math.random()}@teste.local`, passwordHash: 'x', role: 'ADMIN' },
  })
}

describe('exclusão de pedido', () => {
  it('apaga o grafo inteiro do pedido e preserva as partes e a auditoria', async () => {
    const admin = await criarAdmin()
    const { order, creator, editor } = await criarPedido({ status: 'DELIVERED', comArquivos: 2 })
    await testPrisma.transaction.create({
      data: { orderId: order.id, payerId: creator.id, payeeId: editor.id, amount: 200, platformFee: 20, netAmount: 180, status: 'HELD', externalPaymentId: 'dev_x' },
    })
    const conv = await testPrisma.conversation.create({ data: { creatorId: creator.id, editorId: editor.id, orderId: order.id } })
    await testPrisma.message.create({ data: { conversationId: conv.id, senderId: editor.id, content: 'oi' } })
    const delivery = await testPrisma.delivery.create({ data: { orderId: order.id, version: 1, videoUrl: 'https://x/v.mp4' } })
    await testPrisma.revision.create({ data: { orderId: order.id, deliveryId: delivery.id, requestedById: creator.id, description: 'ajustar' } })
    await testPrisma.orderProposal.create({ data: { orderId: order.id, proposedBy: creator.id, amount: 200 } })
    await testPrisma.orderAgreement.create({ data: { orderId: order.id, termsVersion: '1.2', content: 'termo' } })
    await testPrisma.notification.create({
      data: { userId: creator.id, type: 'DELIVERY_RECEIVED', title: 't', body: 'b', relatedOrderId: order.id },
    })

    await deleteOrder(admin.id, order.id)

    expect(await testPrisma.order.findUnique({ where: { id: order.id } })).toBeNull()
    for (const n of [
      await testPrisma.transaction.count(), await testPrisma.conversation.count(), await testPrisma.message.count(),
      await testPrisma.delivery.count(), await testPrisma.revision.count(), await testPrisma.orderFile.count(),
      await testPrisma.orderProposal.count(), await testPrisma.orderAgreement.count(),
      await testPrisma.notification.count({ where: { relatedOrderId: order.id } }),
    ]) expect(n).toBe(0)
    // as partes continuam
    expect(await testPrisma.user.findUnique({ where: { id: creator.id } })).not.toBeNull()
    expect(await testPrisma.user.findUnique({ where: { id: editor.id } })).not.toBeNull()
    // e a exclusão fica registrada
    expect(await testPrisma.auditLog.count({ where: { action: 'ORDER_DELETED', entityId: order.id, actorId: admin.id } })).toBe(1)
  })

  it('pedido concluído e avaliado: refaz a nota média e o total de trabalhos do editor', async () => {
    const admin = await criarAdmin()
    const a = await criarPedido({ status: 'COMPLETED' })
    // segundo pedido do MESMO editor, com outra nota
    const b = await testPrisma.order.create({
      data: { creatorId: a.creator.id, editorId: a.editor.id, categoryId: a.categoria.id, title: 'B', description: 'd', budget: 100, platformFee: 10, status: 'COMPLETED' },
    })
    await testPrisma.review.createMany({
      data: [
        { orderId: a.order.id, reviewerId: a.creator.id, revieweeId: a.editor.id, rating: 5 },
        { orderId: b.id, reviewerId: a.creator.id, revieweeId: a.editor.id, rating: 3 },
      ],
    })
    await testPrisma.editorProfile.update({ where: { id: a.editorProfile.id }, data: { avgRating: 4, ratingBand: 4, totalJobs: 2 } })

    await deleteOrder(admin.id, b.id) // some a nota 3

    const perfil = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: a.editorProfile.id } })
    expect(perfil.avgRating).toBe(5)
    expect(perfil.ratingBand).toBe(5)
    expect(perfil.totalJobs).toBe(1)
  })

  it('recusa pedido com pagamento real no gateway (HELD) e nada é apagado', async () => {
    const admin = await criarAdmin()
    const { order, creator, editor } = await criarPedido({ status: 'IN_PROGRESS' })
    await criarTransacaoHeld(order.id, creator.id, editor.id) // id pix_char_... = cobrança real

    await expect(deleteOrder(admin.id, order.id)).rejects.toThrow(/pagamento real/i)
    expect(await testPrisma.order.findUnique({ where: { id: order.id } })).not.toBeNull()
    expect(await testPrisma.transaction.count()).toBe(1)
  })

  it('pedido inexistente → 404', async () => {
    const admin = await criarAdmin()
    await expect(deleteOrder(admin.id, '00000000-0000-0000-0000-000000000000')).rejects.toThrow(/não encontrado/i)
  })

  it('em produção só com o opt-in ALLOW_USER_DELETION=true', async () => {
    const admin = await criarAdmin()
    const { order } = await criarPedido({ status: 'PENDING' })

    process.env.NODE_ENV = 'production'
    await expect(deleteOrder(admin.id, order.id)).rejects.toThrow(/produção/)
    expect(await testPrisma.order.findUnique({ where: { id: order.id } })).not.toBeNull()

    process.env.ALLOW_USER_DELETION = 'true'
    await deleteOrder(admin.id, order.id)
    expect(await testPrisma.order.findUnique({ where: { id: order.id } })).toBeNull()
  })
})
