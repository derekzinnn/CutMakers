import { Prisma, OrderStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'
import { paymentService } from './payment.service'
import { proposalToDTO } from './proposal.service'
import { revisionService, revisionToDTO } from './revision.service'
import { disputeToDTO } from './dispute.service'
import { agreementToDTO, AUTO_APPROVE_DAYS } from './agreement.service'
import { logEvent } from './audit.service'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface OrderFileInput {
  fileUrl: string
  fileName: string
  fileType: string
}

export interface CreateOrderData {
  editorId: string
  categoryId: string
  portfolioItemId?: string
  title: string
  description: string
  budget: number
  deadline?: Date
  files: OrderFileInput[]
}

export interface ListOrdersParams {
  userId: string
  isAdmin: boolean
  role?: 'creator' | 'editor'
  status?: OrderStatus
  page?: number
  limit?: number
}

export interface CreateDeliveryData {
  videoUrl: string
  message?: string
}

const PLATFORM_FEE_RATE = 0.1

// ─── Regras de transição de status ───────────────────────────────────────────

type ActorRole = 'creator' | 'editor' | 'admin'

const VALID_TRANSITIONS: {
  from: OrderStatus
  to: OrderStatus
  allowedRoles: ActorRole[]
}[] = [
  // Legacy flow (orders created before negotiation feature)
  { from: 'PENDING',            to: 'ACCEPTED',           allowedRoles: ['editor', 'admin'] },
  { from: 'PENDING',            to: 'CANCELLED',          allowedRoles: ['creator', 'editor', 'admin'] },
  { from: 'ACCEPTED',           to: 'IN_PROGRESS',        allowedRoles: ['editor', 'admin'] },
  { from: 'ACCEPTED',           to: 'CANCELLED',          allowedRoles: ['creator', 'editor', 'admin'] },
  // New negotiation flow
  { from: 'NEGOTIATING',        to: 'AWAITING_PAYMENT',   allowedRoles: ['admin'] },
  { from: 'NEGOTIATING',        to: 'CANCELLED',          allowedRoles: ['creator', 'editor', 'admin'] },
  { from: 'AWAITING_PAYMENT',   to: 'IN_PROGRESS',        allowedRoles: ['admin'] },
  { from: 'AWAITING_PAYMENT',   to: 'NEGOTIATING',        allowedRoles: ['admin'] },
  { from: 'AWAITING_PAYMENT',   to: 'CANCELLED',          allowedRoles: ['admin'] },
  // Shared flow
  { from: 'IN_PROGRESS',        to: 'DELIVERED',          allowedRoles: ['admin'] },
  { from: 'IN_PROGRESS',        to: 'CANCELLED',          allowedRoles: ['admin'] },
  { from: 'DELIVERED',          to: 'COMPLETED',          allowedRoles: ['creator', 'admin'] },
  { from: 'DELIVERED',          to: 'REVISION_REQUESTED', allowedRoles: ['creator', 'admin'] },
  { from: 'REVISION_REQUESTED', to: 'IN_PROGRESS',        allowedRoles: ['editor', 'admin'] },
  { from: 'COMPLETED',          to: 'DISPUTED',           allowedRoles: ['admin'] },
  { from: 'CANCELLED',          to: 'DISPUTED',           allowedRoles: ['admin'] },
  { from: 'DISPUTED',           to: 'COMPLETED',          allowedRoles: ['admin'] },
  { from: 'DISPUTED',           to: 'CANCELLED',          allowedRoles: ['admin'] },
]

// ─── Includes reutilizáveis ──────────────────────────────────────────────────

const orderInclude = {
  category: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true, avatarUrl: true } },
  editor: { select: { id: true, name: true, avatarUrl: true } },
  files: true,
  _count: { select: { deliveries: true, revisions: true } },
} satisfies Prisma.OrderInclude

const orderDetailInclude = {
  category: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true, avatarUrl: true } },
  editor: { select: { id: true, name: true, avatarUrl: true } },
  files: true,
  deliveries: { orderBy: { version: 'asc' as const } },
  transaction: {
    select: {
      id: true,
      status: true,
      amount: true,
      platformFee: true,
      netAmount: true,
      externalPaymentId: true,
      createdAt: true,
    },
  },
  review: {
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      reviewer: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
  proposals: {
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  revisions: {
    include: {
      delivery: { select: { id: true, version: true } },
      requestedBy: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  dispute: true,
  agreement: true,
  _count: { select: { deliveries: true, revisions: true } },
} satisfies Prisma.OrderInclude

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>
type OrderDetailWithRelations = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class OrderService {
  async create(creatorId: string, data: CreateOrderData) {
    if (data.editorId === creatorId) {
      throw BadRequest('Você não pode criar um pedido para si mesmo')
    }
    if (data.budget <= 0) throw BadRequest('Orçamento deve ser positivo')

    const editor = await prisma.user.findUnique({
      where: { id: data.editorId },
      select: { id: true, role: true },
    })
    if (!editor) throw BadRequest('Editor não encontrado')
    if (editor.role !== 'EDITOR' && editor.role !== 'BOTH') {
      throw BadRequest('Usuário selecionado não é editor')
    }

    const category = await prisma.category.findUnique({ where: { id: data.categoryId } })
    if (!category) throw BadRequest('Categoria não encontrada')

    if (data.portfolioItemId) {
      const item = await prisma.portfolioItem.findUnique({
        where: { id: data.portfolioItemId },
        include: { editorProfile: true },
      })
      if (!item) throw BadRequest('Item de portfólio não encontrado')
      if (item.editorProfile.userId !== data.editorId) {
        throw BadRequest('Item de portfólio não pertence ao editor selecionado')
      }
    }

    const platformFee = Math.round(data.budget * PLATFORM_FEE_RATE * 100) / 100

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          creatorId,
          editorId: data.editorId,
          categoryId: data.categoryId,
          portfolioItemId: data.portfolioItemId,
          title: data.title.trim(),
          description: data.description.trim(),
          budget: data.budget,
          platformFee,
          deadline: data.deadline,
          status: 'NEGOTIATING',
          files: {
            create: data.files.map((f) => ({
              fileUrl: f.fileUrl,
              fileName: f.fileName,
              fileType: f.fileType,
            })),
          },
        },
        include: orderInclude,
      })

      // First proposal is auto-created from the creator's initial budget
      await tx.orderProposal.create({
        data: {
          orderId: created.id,
          proposedBy: creatorId,
          amount: data.budget,
          status: 'PENDING',
        },
      })

      await tx.notification.create({
        data: {
          userId: data.editorId,
          type: 'NEW_ORDER',
          title: 'Nova proposta recebida!',
          body: `${created.creator.name} enviou uma proposta de R$ ${data.budget.toFixed(2)} para "${created.title}"`,
          relatedOrderId: created.id,
        },
      })

      return created
    })

    await logEvent({ actorId: creatorId, action: 'ORDER_CREATED', entityType: 'Order', entityId: order.id })

    return this.toDTO(order)
  }

  async list(params: ListOrdersParams) {
    const page = Math.max(params.page ?? 1, 1)
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50)

    const where: Prisma.OrderWhereInput = {}

    if (params.role === 'creator') {
      where.creatorId = params.userId
    } else if (params.role === 'editor') {
      where.editorId = params.userId
    } else if (!params.isAdmin) {
      where.OR = [{ creatorId: params.userId }, { editorId: params.userId }]
    }

    if (params.status) where.status = params.status

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      }),
      prisma.order.count({ where }),
    ])

    return {
      orders: orders.map(this.toDTO),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getById(id: string, userId: string, isAdmin: boolean) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: orderDetailInclude,
    })
    if (!order) throw NotFound('Pedido não encontrado')

    if (!isAdmin && order.creatorId !== userId && order.editorId !== userId) {
      throw Forbidden('Você não tem acesso a este pedido')
    }
    return this.toDetailDTO(order, userId, isAdmin)
  }

  async updateStatus(orderId: string, userId: string, isAdmin: boolean, newStatus: OrderStatus) {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw NotFound('Pedido não encontrado')

    const isCreator = order.creatorId === userId
    const isEditor = order.editorId === userId

    if (!isAdmin && !isCreator && !isEditor) {
      throw Forbidden('Você não tem acesso a este pedido')
    }

    const actorRole: ActorRole = isAdmin ? 'admin' : isCreator ? 'creator' : 'editor'

    const transition = VALID_TRANSITIONS.find(
      (t) => t.from === order.status && t.to === newStatus && t.allowedRoles.includes(actorRole),
    )

    if (!transition) {
      throw BadRequest(
        `Transição de "${order.status}" para "${newStatus}" não é permitida para ${actorRole}`,
      )
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: orderDetailInclude,
    })

    if (newStatus === 'COMPLETED') {
      await paymentService.releasePayment(orderId, userId)
      await prisma.editorProfile.updateMany({
        where: { userId: order.editorId },
        data: { totalJobs: { increment: 1 } },
      })
    }

    if (newStatus === 'CANCELLED') {
      await logEvent({ actorId: userId, action: 'ORDER_CANCELLED', entityType: 'Order', entityId: orderId })
    }

    await this.notifyStatusChange(order.id, order.title, order.creatorId, order.editorId, newStatus, userId)

    return this.toDetailDTO(updated, userId, isAdmin)
  }

  async createDelivery(orderId: string, editorId: string, data: CreateDeliveryData) {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.editorId !== editorId) throw Forbidden('Apenas o editor do pedido pode enviar entregas')
    if (order.status !== 'IN_PROGRESS') {
      throw BadRequest('Pedido precisa estar em andamento para enviar uma entrega')
    }

    const existingCount = await prisma.delivery.count({ where: { orderId } })
    const version = existingCount + 1

    // Find or create the conversation so the delivery message lands in chat
    let conversation = await prisma.conversation.findUnique({ where: { orderId } })
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { creatorId: order.creatorId, editorId: order.editorId, orderId },
      })
    }

    const chatMessage = data.message?.trim()
      ? `📦 Entrega v${version}: ${data.message.trim()}`
      : `📦 Entrega v${version} enviada. Revise e aprove!`

    const [delivery] = await prisma.$transaction([
      prisma.delivery.create({
        data: { orderId, videoUrl: data.videoUrl, message: data.message, version },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { status: 'DELIVERED' },
      }),
      prisma.notification.create({
        data: {
          userId: order.creatorId,
          type: 'DELIVERY_RECEIVED',
          title: 'Entrega recebida!',
          body: `O editor enviou a versão ${version} do pedido "${order.title}". Revise e aprove ou solicite revisão.`,
          relatedOrderId: orderId,
        },
      }),
      prisma.message.create({
        data: { conversationId: conversation.id, senderId: editorId, content: chatMessage },
      }),
      // Uma nova entrega resolve automaticamente qualquer revisão pendente
      revisionService.markAddressedOp(orderId),
    ])

    return {
      id: delivery.id,
      orderId: delivery.orderId,
      videoUrl: delivery.videoUrl,
      message: delivery.message,
      version: delivery.version,
      createdAt: delivery.createdAt,
    }
  }

  async addFiles(orderId: string, creatorId: string, files: OrderFileInput[]) {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.creatorId !== creatorId) throw Forbidden('Apenas o creator do pedido pode adicionar arquivos')
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw BadRequest('Não é possível adicionar arquivos a um pedido finalizado')
    }
    if (files.length === 0) throw BadRequest('Nenhum arquivo enviado')

    const created = await prisma.orderFile.createMany({
      data: files.map((f) => ({
        orderId,
        fileUrl: f.fileUrl,
        fileName: f.fileName,
        fileType: f.fileType,
      })),
    })

    return { count: created.count }
  }

  /**
   * Cláusula 4b do contrato: entregas sem resposta do creator por mais de
   * AUTO_APPROVE_DAYS dias são aprovadas automaticamente (pagamento liberado).
   * Chamado de forma oportunista no login (sem cron por enquanto).
   */
  async autoApproveStaleDeliveries() {
    const cutoff = new Date(Date.now() - AUTO_APPROVE_DAYS * 24 * 60 * 60 * 1000)
    const stale = await prisma.order.findMany({
      // updatedAt marca a última transição de status (→ DELIVERED)
      where: { status: 'DELIVERED', updatedAt: { lt: cutoff } },
      select: { id: true, title: true, creatorId: true, editorId: true },
    })

    for (const order of stale) {
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } }),
        prisma.editorProfile.updateMany({
          where: { userId: order.editorId },
          data: { totalJobs: { increment: 1 } },
        }),
        prisma.notification.create({
          data: {
            userId: order.creatorId,
            type: 'PAYMENT_RELEASED',
            title: 'Entrega aprovada automaticamente',
            body: `A entrega de "${order.title}" foi aprovada automaticamente após ${AUTO_APPROVE_DAYS} dias sem resposta (cláusula 4b do contrato).`,
            relatedOrderId: order.id,
          },
        }),
        prisma.notification.create({
          data: {
            userId: order.editorId,
            type: 'PAYMENT_RELEASED',
            title: 'Pedido concluído — pagamento liberado!',
            body: `A entrega de "${order.title}" foi aprovada automaticamente e o pagamento foi liberado.`,
            relatedOrderId: order.id,
          },
        }),
      ])
      await paymentService.releasePayment(order.id)
    }
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private async notifyStatusChange(
    orderId: string,
    orderTitle: string,
    creatorId: string,
    editorId: string,
    newStatus: OrderStatus,
    changedById: string,
  ) {
    type NotifConfig = { type: Parameters<typeof prisma.notification.create>[0]['data']['type']; title: string; body: string }

    const notifMap: Partial<Record<OrderStatus, NotifConfig>> = {
      ACCEPTED: {
        type: 'ORDER_ACCEPTED',
        title: 'Pedido aceito!',
        body: `O editor aceitou o pedido "${orderTitle}". Inicie o pagamento para ele começar.`,
      },
      CANCELLED: {
        type: 'ORDER_CANCELLED',
        title: 'Pedido cancelado',
        body: `O pedido "${orderTitle}" foi cancelado.`,
      },
      REVISION_REQUESTED: {
        type: 'REVISION_REQUESTED',
        title: 'Revisão solicitada',
        body: `O creator solicitou revisão no pedido "${orderTitle}".`,
      },
      COMPLETED: {
        type: 'PAYMENT_RELEASED',
        title: 'Pedido concluído!',
        body: `O pedido "${orderTitle}" foi concluído e o pagamento foi liberado.`,
      },
    }

    const config = notifMap[newStatus]
    if (!config) return

    const recipientId = changedById === creatorId ? editorId : creatorId

    await prisma.notification.create({
      data: {
        userId: recipientId,
        type: config.type,
        title: config.title,
        body: config.body,
        relatedOrderId: orderId,
      },
    })
  }

  // ─── DTOs ─────────────────────────────────────────────────────────────────

  private toDTO = (o: OrderWithRelations) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    status: o.status,
    budget: Number(o.budget),
    platformFee: Number(o.platformFee),
    deadline: o.deadline,
    category: o.category,
    creator: o.creator,
    editor: o.editor,
    files: o.files.map((f) => ({
      id: f.id,
      fileUrl: f.fileUrl,
      fileName: f.fileName,
      fileType: f.fileType,
      uploadedAt: f.uploadedAt,
    })),
    deliveriesCount: o._count.deliveries,
    revisionsCount: o._count.revisions,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  })

  private toDetailDTO = (o: OrderDetailWithRelations, viewerId: string, isAdmin: boolean) => {
    void viewerId
    void isAdmin

    return {
      id: o.id,
      title: o.title,
      description: o.description,
      status: o.status,
      budget: Number(o.budget),
      platformFee: Number(o.platformFee),
      deadline: o.deadline,
      category: o.category,
      creator: o.creator,
      editor: o.editor,
      files: o.files.map((f) => ({
        id: f.id,
        fileUrl: f.fileUrl,
        fileName: f.fileName,
        fileType: f.fileType,
        uploadedAt: f.uploadedAt,
      })),
      filesHidden: false,
      deliveries: o.deliveries.map((d) => ({
        id: d.id,
        videoUrl: d.videoUrl,
        message: d.message,
        version: d.version,
        createdAt: d.createdAt,
      })),
      transaction: o.transaction
        ? {
            id: o.transaction.id,
            status: o.transaction.status,
            amount: Number(o.transaction.amount),
            platformFee: Number(o.transaction.platformFee),
            netAmount: Number(o.transaction.netAmount),
            externalPaymentId: o.transaction.externalPaymentId,
            createdAt: o.transaction.createdAt,
          }
        : null,
      review: o.review
        ? {
            id: o.review.id,
            rating: o.review.rating,
            comment: o.review.comment,
            createdAt: o.review.createdAt,
            reviewer: {
              id: o.review.reviewer.id,
              name: o.review.reviewer.name,
              avatarUrl: o.review.reviewer.avatarUrl,
            },
          }
        : null,
      proposals: o.proposals.map(proposalToDTO),
      revisions: o.revisions.map(revisionToDTO),
      dispute: o.dispute ? disputeToDTO(o.dispute) : null,
      agreement: o.agreement ? agreementToDTO(o.agreement) : null,
      deliveriesCount: o._count.deliveries,
      revisionsCount: o._count.revisions,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }
  }
}

export const orderService = new OrderService()
