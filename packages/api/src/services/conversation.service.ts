import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'

// ─── Includes ────────────────────────────────────────────────────────────────

const conversationInclude = {
  creator: { select: { id: true, name: true, avatarUrl: true } },
  editor: { select: { id: true, name: true, avatarUrl: true } },
  order: { select: { id: true, title: true } },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.ConversationInclude

const messageInclude = {
  sender: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.MessageInclude

type ConversationWithRelations = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>
type MessageWithRelations = Prisma.MessageGetPayload<{ include: typeof messageInclude }>

// ─── Service ─────────────────────────────────────────────────────────────────

export class ConversationService {
  async getOrCreateByOrder(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, creatorId: true, editorId: true },
    })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.creatorId !== userId && order.editorId !== userId) {
      throw Forbidden('Você não faz parte deste pedido')
    }

    const existing = await prisma.conversation.findUnique({
      where: { orderId },
      include: conversationInclude,
    })
    if (existing) return this.toDTO(existing)

    const created = await prisma.conversation.create({
      data: {
        creatorId: order.creatorId,
        editorId: order.editorId,
        orderId,
      },
      include: conversationInclude,
    })
    return this.toDTO(created)
  }

  async listForUser(userId: string) {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ creatorId: userId }, { editorId: userId }],
      },
      include: conversationInclude,
      orderBy: { createdAt: 'desc' },
    })
    return conversations.map(this.toDTO)
  }

  async getMessages(conversationId: string, userId: string, page = 1, limit = 50) {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
    if (!conv) throw NotFound('Conversa não encontrada')
    if (conv.creatorId !== userId && conv.editorId !== userId) {
      throw Forbidden('Você não faz parte desta conversa')
    }

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: messageInclude,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    await prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    })

    return messages.map(this.toMessageDTO)
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } })
    if (!conv) throw NotFound('Conversa não encontrada')
    if (conv.creatorId !== senderId && conv.editorId !== senderId) {
      throw Forbidden('Você não faz parte desta conversa')
    }
    if (!content.trim()) throw BadRequest('Mensagem não pode ser vazia')

    const recipientId = senderId === conv.creatorId ? conv.editorId : conv.creatorId

    const message = await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: { conversationId, senderId, content: content.trim() },
        include: messageInclude,
      })
      await tx.notification.create({
        data: {
          userId: recipientId,
          type: 'NEW_MESSAGE',
          title: 'Nova mensagem',
          body: content.trim().slice(0, 100),
          ...(conv.orderId ? { relatedOrderId: conv.orderId } : {}),
        },
      })
      return msg
    })

    return this.toMessageDTO(message)
  }

  // ─── DTOs ─────────────────────────────────────────────────────────────────

  private toDTO = (c: ConversationWithRelations) => ({
    id: c.id,
    creator: c.creator,
    editor: c.editor,
    order: c.order,
    lastMessage: c.messages[0]
      ? {
          content: c.messages[0].content,
          senderId: c.messages[0].senderId,
          createdAt: c.messages[0].createdAt,
        }
      : null,
    createdAt: c.createdAt,
  })

  private toMessageDTO = (m: MessageWithRelations) => ({
    id: m.id,
    conversationId: m.conversationId,
    sender: m.sender,
    content: m.content,
    readAt: m.readAt,
    createdAt: m.createdAt,
  })
}

export const conversationService = new ConversationService()
