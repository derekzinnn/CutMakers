import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarPedido } from './fixtures'
import { conversationService } from '../src/services/conversation.service'

/**
 * Admin mediando: precisa LER a conversa de um pedido (mensagens que viram prova
 * na disputa), mas NÃO participa dela. Regras verificadas aqui:
 *   - admin abre a conversa e lê as mensagens sem ser creator/editor
 *   - a leitura do admin NÃO marca as mensagens como lidas (senão zeraria o
 *     "não lida" das partes)
 *   - admin é somente-leitura: enviar mensagem é barrado
 *   - terceiro sem relação com o pedido continua barrado
 */
async function criarAdmin() {
  return testPrisma.user.create({
    data: {
      name: 'Admin Teste',
      email: `admin-${Date.now()}-${Math.random()}@teste.local`,
      passwordHash: 'nao-usado',
      role: 'ADMIN',
    },
  })
}

describe('admin lê a conversa do pedido', () => {
  beforeEach(async () => {
    await limparBanco()
  })

  async function cenario() {
    const { order, creator, editor } = await criarPedido({ status: 'IN_PROGRESS' })
    const conv = await testPrisma.conversation.create({
      data: { orderId: order.id, creatorId: creator.id, editorId: editor.id },
    })
    // uma mensagem de cada parte, ainda não lidas
    await testPrisma.message.createMany({
      data: [
        { conversationId: conv.id, senderId: creator.id, content: 'oi, segue o briefing' },
        { conversationId: conv.id, senderId: editor.id, content: 'recebido, começo hoje' },
      ],
    })
    const admin = await criarAdmin()
    return { order, creator, editor, conv, admin }
  }

  it('admin abre a conversa pelo pedido sem ser participante', async () => {
    const { order, admin } = await cenario()
    const dto = await conversationService.getOrCreateByOrder(order.id, admin.id, true)
    expect(dto.id).toBeTruthy()
    expect(dto.order?.id).toBe(order.id)
  })

  it('admin lê as mensagens e NÃO as marca como lidas', async () => {
    const { conv, admin } = await cenario()
    const msgs = await conversationService.getMessages(conv.id, admin.id, true)
    expect(msgs).toHaveLength(2)
    // nenhuma marcada como lida pela visualização do admin
    const naoLidas = await testPrisma.message.count({ where: { conversationId: conv.id, readAt: null } })
    expect(naoLidas).toBe(2)
  })

  it('participante lendo MARCA como lida (contraste com o admin)', async () => {
    const { conv, creator } = await cenario()
    await conversationService.getMessages(conv.id, creator.id, false)
    // o creator leu → a mensagem do editor fica lida; a dele própria não conta
    const doEditorNaoLidas = await testPrisma.message.count({
      where: { conversationId: conv.id, readAt: null, senderId: { not: creator.id } },
    })
    expect(doEditorNaoLidas).toBe(0)
  })

  it('admin é somente-leitura: enviar mensagem é barrado', async () => {
    const { conv, admin } = await cenario()
    await expect(
      conversationService.sendMessage(conv.id, admin.id, 'intervenção do admin'),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('terceiro sem relação com o pedido continua barrado', async () => {
    const { conv } = await cenario()
    const estranho = await testPrisma.user.create({
      data: { name: 'Estranho', email: `x-${Date.now()}@teste.local`, passwordHash: 'x', role: 'CREATOR' },
    })
    await expect(
      conversationService.getMessages(conv.id, estranho.id, false),
    ).rejects.toMatchObject({ status: 403 })
  })
})
