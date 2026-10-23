import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarCreator, criarEditor, criarPedido, criarTransacaoHeld } from './fixtures'
import { deleteUser } from '../src/services/user-delete.service'

/**
 * Exclusão definitiva (só dev): apaga o usuário e TUDO que depende dele, na ordem das chaves
 * estrangeiras. O risco real é uma FK esquecida estourar no meio — daí o teste contra Postgres
 * real, com o grafo completo de um pedido (conversa, mensagem, entrega, transação, contrato…).
 */
beforeEach(async () => {
  await limparBanco()
})

const NODE_ENV_ORIGINAL = process.env.NODE_ENV
afterEach(() => {
  process.env.NODE_ENV = NODE_ENV_ORIGINAL
})

async function criarAdmin() {
  return testPrisma.user.create({
    data: { name: 'Admin', email: `admin-${Date.now()}-${Math.random()}@teste.local`, passwordHash: 'x', role: 'ADMIN' },
  })
}

describe('exclusão de usuário (dev)', () => {
  it('apaga o editor com pedido, transação, conversa, mensagem, entrega e notificação — sem sobrar nada', async () => {
    const admin = await criarAdmin()
    const { order, creator, editor } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)
    const conv = await testPrisma.conversation.create({ data: { creatorId: creator.id, editorId: editor.id, orderId: order.id } })
    await testPrisma.message.create({ data: { conversationId: conv.id, senderId: editor.id, content: 'oi' } })
    await testPrisma.delivery.create({ data: { orderId: order.id, version: 1, videoUrl: 'https://x/v.mp4' } })
    await testPrisma.notification.create({
      data: { userId: creator.id, type: 'DELIVERY_RECEIVED', title: 't', body: 'b', relatedOrderId: order.id },
    })

    await deleteUser(admin.id, editor.id)

    expect(await testPrisma.user.findUnique({ where: { id: editor.id } })).toBeNull()
    expect(await testPrisma.order.findUnique({ where: { id: order.id } })).toBeNull()
    expect(await testPrisma.transaction.count()).toBe(0)
    expect(await testPrisma.conversation.count()).toBe(0)
    expect(await testPrisma.message.count()).toBe(0)
    expect(await testPrisma.delivery.count()).toBe(0)
    expect(await testPrisma.notification.count({ where: { relatedOrderId: order.id } })).toBe(0)
    // a contraparte continua existindo
    expect(await testPrisma.user.findUnique({ where: { id: creator.id } })).not.toBeNull()
  })

  it('mantém a auditoria, só desvinculando o ator, e registra USER_DELETED', async () => {
    const admin = await criarAdmin()
    const creator = await criarCreator()
    await testPrisma.auditLog.create({
      data: { actorId: creator.id, action: 'ORDER_CREATED', entityType: 'Order', entityId: 'o1' },
    })

    await deleteUser(admin.id, creator.id)

    const antigo = await testPrisma.auditLog.findFirstOrThrow({ where: { action: 'ORDER_CREATED' } })
    expect(antigo.actorId).toBeNull()
    const log = await testPrisma.auditLog.findFirstOrThrow({ where: { action: 'USER_DELETED' } })
    expect(log.actorId).toBe(admin.id)
    expect(log.entityId).toBe(creator.id)
  })

  it('apaga o criador junto com suas solicitações e as propostas recebidas', async () => {
    const admin = await criarAdmin()
    const creator = await criarCreator()
    const { user: editor } = await criarEditor()
    const cat = await testPrisma.category.create({ data: { name: `Cat-${Date.now()}` } })
    const req = await testPrisma.projectRequest.create({
      data: { creatorId: creator.id, categoryId: cat.id, title: 'T', description: 'D' },
    })
    await testPrisma.requestProposal.create({
      data: { request: { connect: { id: req.id } }, editor: { connect: { id: editor.id } }, amount: 100, deliveryDays: 2, message: 'm' },
    })

    await deleteUser(admin.id, creator.id)

    expect(await testPrisma.projectRequest.count()).toBe(0)
    expect(await testPrisma.requestProposal.count()).toBe(0)
    expect(await testPrisma.user.findUnique({ where: { id: editor.id } })).not.toBeNull()
  })

  it('recusa admin, a si mesmo e produção', async () => {
    const admin = await criarAdmin()
    const outroAdmin = await criarAdmin()
    const creator = await criarCreator()

    await expect(deleteUser(admin.id, outroAdmin.id)).rejects.toThrow()
    await expect(deleteUser(admin.id, admin.id)).rejects.toThrow()

    process.env.NODE_ENV = 'production'
    await expect(deleteUser(admin.id, creator.id)).rejects.toThrow(/produção/)
    expect(await testPrisma.user.findUnique({ where: { id: creator.id } })).not.toBeNull()
  })
})
