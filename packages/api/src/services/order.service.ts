import { Prisma, OrderStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest, Conflict } from '../lib/errors'
import { paymentService } from './payment.service'
import { proposalToDTO } from './proposal.service'
import { revisionService, revisionToDTO } from './revision.service'
import { disputeToDTO } from './dispute.service'
import { agreementToDTO, AUTO_APPROVE_DAYS } from './agreement.service'
import { logEvent } from './audit.service'
import { platformFeeAsNumber } from '../lib/fees'
import { canBeHiredAsEditor } from '../middlewares/role.middleware'

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

/** Intervalo mínimo entre varreduras de auto-aprovação num mesmo processo. */
const AUTO_APPROVE_THROTTLE_MS = 5 * 60 * 1000
/** Teto de pedidos por varredura — evita uma passada única e longa quando há acumulo. */
const AUTO_APPROVE_BATCH = 100
let lastAutoApproveRun = 0

/**
 * Tentativas de gravar a entrega quando várias disputam a mesma versão.
 * Com N escritores simultâneos o perdedor pode perder até N-1 vezes — o teste de
 * integração exercita 5 em paralelo, então o teto precisa cobrir isso.
 */
const MAX_DELIVERY_ATTEMPTS = 6

/** Antes destes status o pedido ainda não foi pago — arquivos ficam retidos. */
const PRE_WORK_STATUSES: OrderStatus[] = ['NEGOTIATING', 'AWAITING_PAYMENT', 'PENDING']

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
  // Saída de disputa pelas mãos do admin (o caminho normal é dispute.resolveDispute,
  // que move o escrow junto; estas duas existem como escape manual)
  { from: 'DISPUTED',           to: 'COMPLETED',          allowedRoles: ['admin'] },
  { from: 'DISPUTED',           to: 'CANCELLED',          allowedRoles: ['admin'] },
  // REMOVIDO: COMPLETED→DISPUTED e CANCELLED→DISPUTED.
  // Elas deixavam o pedido em DISPUTED sem nenhuma linha Dispute — só openDispute
  // cria a disputa, e ele recusa qualquer status fora de DELIVERED/REVISION_REQUESTED.
  // O resultado era um pedido congelado exibindo o banner "Em disputa" para as duas
  // partes, com as ações escondidas, e resolveDispute falhando com a mensagem
  // enganosa "Disputa já foi resolvida".
  //
  // Disputa pós-conclusão é uma feature legítima, mas não é um PATCH de status: o
  // escrow já foi liberado ao editor, então exige um fluxo de estorno próprio em
  // dispute.service. Enquanto isso não existe, melhor não permitir a transição do
  // que permitir um estado que o sistema não sabe resolver.
]

// ─── Includes reutilizáveis ──────────────────────────────────────────────────

// A listagem NAO carrega os arquivos de proposito. Os cards de dashboard só
// precisam da contagem, e trazer as URLs aqui furaria o gate de pagamento do
// detalhe (um editor listaria /orders e leria os links sem ter pago). De quebra
// evita um join por linha em todo carregamento de dashboard.
const orderInclude = {
  category: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true, avatarUrl: true } },
  editor: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { deliveries: true, revisions: true, files: true } },
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
      externalPaymentId: true,
      pixCode: true,
      pixQrCode: true,
      chargeExpiresAt: true,
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
    if (!canBeHiredAsEditor(editor.role)) {
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

    const platformFee = platformFeeAsNumber(data.budget)

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

    // Claim otimista: a transição só vale se o pedido ainda estiver no status que
    // acabamos de validar. Sem isso, dois cliques em "Aprovar entrega" passavam os
    // dois pela validação e incrementavam totalJobs em dobro (mesma classe de bug
    // da varredura de auto-aprovação).
    const claim = await prisma.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: newStatus },
    })
    if (claim.count === 0) {
      throw Conflict('O status do pedido mudou enquanto você agia. Recarregue a página.')
    }

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

    await this.notifyStatusChange(
      order.id,
      order.title,
      order.creatorId,
      order.editorId,
      newStatus,
      userId,
      actorRole,
    )

    // Lido após os efeitos colaterais para o DTO já refletir o escrow liberado
    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: orderDetailInclude,
    })

    return this.toDetailDTO(updated, userId, isAdmin)
  }

  async createDelivery(orderId: string, editorId: string, data: CreateDeliveryData) {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.editorId !== editorId) throw Forbidden('Apenas o editor do pedido pode enviar entregas')
    if (order.status !== 'IN_PROGRESS') {
      throw BadRequest('Pedido precisa estar em andamento para enviar uma entrega')
    }

    // TUDO numa transação interativa dentro do retry.
    //
    // A primeira versão deste código criava a conversa com `upsert` FORA do loop,
    // na crença de que upsert fosse atômico. Não é: em unique NULÁVEL (orderId é
    // `String?`) o Prisma não consegue usar ON CONFLICT nativo e emula com
    // SELECT-então-INSERT. Duas entregas simultâneas inseriam as duas e uma
    // estourava P2002 — fora do try, então o erro cru escapava como 500.
    // Os testes de integração pegaram isso (test/corridas.integration.test.ts).
    //
    // Com a conversa dentro da transação e do retry, perder a corrida em QUALQUER
    // ponto (conversa ou versão da entrega) apenas refaz a tentativa, e aí o
    // upsert encontra a linha que o vencedor criou.
    for (let attempt = 1; ; attempt++) {
      try {
        const delivery = await prisma.$transaction(async (tx) => {
          const conversation = await tx.conversation.upsert({
            where: { orderId },
            create: { creatorId: order.creatorId, editorId: order.editorId, orderId },
            update: {},
          })

          // A versão vem da contagem de entregas. Duas transações concorrentes podem
          // ler a mesma contagem; aí o @@unique([orderId, version]) rejeita a segunda
          // e o retry recalcula. Preferido a lock pessimista: o caso comum (sem
          // corrida) não paga nada por isso.
          const existingCount = await tx.delivery.count({ where: { orderId } })
          const version = existingCount + 1

          const chatMessage = data.message?.trim()
            ? `📦 Entrega v${version}: ${data.message.trim()}`
            : `📦 Entrega v${version} enviada. Revise e aprove!`

          const criada = await tx.delivery.create({
            data: { orderId, videoUrl: data.videoUrl, message: data.message, version },
          })

          await tx.order.update({ where: { id: orderId }, data: { status: 'DELIVERED' } })

          await tx.notification.create({
            data: {
              userId: order.creatorId,
              type: 'DELIVERY_RECEIVED',
              title: 'Entrega recebida!',
              body: `O editor enviou a versão ${version} do pedido "${order.title}". Revise e aprove ou solicite revisão.`,
              relatedOrderId: orderId,
            },
          })

          await tx.message.create({
            data: { conversationId: conversation.id, senderId: editorId, content: chatMessage },
          })

          // Uma nova entrega resolve automaticamente qualquer revisão pendente
          await revisionService.markAddressed(orderId, tx)

          return criada
        })

        return {
          id: delivery.id,
          orderId: delivery.orderId,
          videoUrl: delivery.videoUrl,
          message: delivery.message,
          version: delivery.version,
          createdAt: delivery.createdAt,
        }
      } catch (err) {
        const perdeuCorrida =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
        if (perdeuCorrida && attempt < MAX_DELIVERY_ATTEMPTS) {
          // Sem pausa, os N perdedores refazem a tentativa no MESMO instante e
          // colidem de novo, rodada após rodada, até esgotar as tentativas.
          // Backoff curto com jitter espalha as retentativas no tempo.
          await new Promise((r) => setTimeout(r, Math.random() * 25 * attempt))
          continue
        }
        if (perdeuCorrida) {
          throw Conflict('Não foi possível registrar a entrega. Tente novamente.')
        }
        throw err
      }
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
      take: AUTO_APPROVE_BATCH,
    })

    for (const order of stale) {
      // Claim otimista dentro da transação: só quem efetivamente move
      // DELIVERED→COMPLETED executa os efeitos. Antes, duas varreduras simultâneas
      // (dois logins, duas instâncias) incrementavam totalJobs duas vezes pela
      // mesma entrega e notificavam em dobro.
      const processed = await prisma.$transaction(async (tx) => {
        const claim = await tx.order.updateMany({
          where: { id: order.id, status: 'DELIVERED' },
          data: { status: 'COMPLETED' },
        })
        if (claim.count === 0) return false

        await tx.editorProfile.updateMany({
          where: { userId: order.editorId },
          data: { totalJobs: { increment: 1 } },
        })

        await tx.notification.createMany({
          data: [
            {
              userId: order.creatorId,
              type: 'PAYMENT_RELEASED',
              title: 'Entrega aprovada automaticamente',
              body: `A entrega de "${order.title}" foi aprovada automaticamente após ${AUTO_APPROVE_DAYS} dias sem resposta (cláusula 4b do contrato).`,
              relatedOrderId: order.id,
            },
            {
              userId: order.editorId,
              type: 'PAYMENT_RELEASED',
              title: 'Pedido concluído — pagamento liberado!',
              body: `A entrega de "${order.title}" foi aprovada automaticamente e o pagamento foi liberado.`,
              relatedOrderId: order.id,
            },
          ],
        })

        return true
      })

      // Outra varredura (ou o próprio creator aprovando) chegou primeiro
      if (!processed) continue

      await paymentService.releasePayment(order.id)
    }

    return { processed: stale.length }
  }

  /**
   * Dispara a varredura em background, no máximo uma vez por janela de throttle.
   *
   * Isto é um job disfarçado de efeito colateral do login, e o destino é um cron
   * chamando `autoApproveStaleDeliveries()` direto — a assinatura já serve. Enquanto
   * isso não existe, três salvaguardas tornam o arranjo tolável:
   *   1. throttle por processo: 100 logins/min não viram 100 varreduras
   *   2. claim otimista por pedido: instâncias concorrentes não duplicam efeitos
   *   3. fire-and-forget: a latência do login não depende do tamanho da tabela
   */
  triggerAutoApproveInBackground() {
    const now = Date.now()
    if (now - lastAutoApproveRun < AUTO_APPROVE_THROTTLE_MS) return
    lastAutoApproveRun = now

    void this.autoApproveStaleDeliveries().catch((err) => {
      // Falha aqui nunca deve derrubar o login que disparou a varredura
      console.error('[auto-approve] varredura falhou', err)
    })
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private async notifyStatusChange(
    orderId: string,
    orderTitle: string,
    creatorId: string,
    editorId: string,
    newStatus: OrderStatus,
    changedById: string,
    actorRole: ActorRole,
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

    // Quando quem muda o status é uma das partes, só a contraparte precisa saber.
    // Quando é o admin (resolução de disputa, intervenção manual) não existe
    // "contraparte": o ternário antigo caía sempre no creator e o editor nunca
    // era avisado — inclusive ao ter o próprio pagamento liberado.
    const recipientIds =
      actorRole === 'admin'
        ? [creatorId, editorId]
        : [changedById === creatorId ? editorId : creatorId]

    await prisma.notification.createMany({
      data: recipientIds.map((userId) => ({
        userId,
        type: config.type,
        title: config.title,
        body: config.body,
        relatedOrderId: orderId,
      })),
    })
  }

  // ─── DTOs ─────────────────────────────────────────────────────────────────

  private toDTO = (o: OrderWithRelations) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    status: o.status,
    budget: Number(o.budget),
    deadline: o.deadline,
    category: o.category,
    creator: o.creator,
    editor: o.editor,
    filesCount: o._count.files,
    deliveriesCount: o._count.deliveries,
    revisionsCount: o._count.revisions,
    revisionsIncluded: o.revisionsIncluded,
    requestId: o.requestId,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  })

  private toDetailDTO = (o: OrderDetailWithRelations, viewerId: string, isAdmin: boolean) => {
    // Gate de arquivos: o editor só acessa o material bruto do criador depois que o
    // pagamento entra em custódia. Antes disso ele vê briefing, valor e prazo — o
    // suficiente para negociar — mas não as URLs dos arquivos, que são links
    // Cloudinary públicos e, uma vez entregues, não podem ser "desentregues".
    // Regra do produto: Fase 4.2 (payment gate) e decisão 4 da Fase 12.
    const filesHidden =
      !isAdmin && o.editorId === viewerId && PRE_WORK_STATUSES.includes(o.status)

    return {
      id: o.id,
      title: o.title,
      description: o.description,
      status: o.status,
      budget: Number(o.budget),
      deadline: o.deadline,
      category: o.category,
      creator: o.creator,
      editor: o.editor,
      files: filesHidden
        ? []
        : o.files.map((f) => ({
            id: f.id,
            fileUrl: f.fileUrl,
            fileName: f.fileName,
            fileType: f.fileType,
            uploadedAt: f.uploadedAt,
          })),
      filesHidden,
      // Contagem sempre visível: o editor precisa saber que existe material
      // esperando por ele, sem conseguir baixá-lo ainda.
      filesCount: o.files.length,
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
            externalPaymentId: o.transaction.externalPaymentId,
            // O PIX em aberto só interessa a quem paga (e ao admin, que media): o editor
            // não precisa do copia-e-cola da cobrança de outra pessoa
            pix:
              o.transaction.status === 'PENDING' &&
              o.transaction.pixCode &&
              (isAdmin || o.creatorId === viewerId)
                ? {
                    pixCode: o.transaction.pixCode,
                    pixQrCode: o.transaction.pixQrCode,
                    expiresAt: o.transaction.chargeExpiresAt,
                  }
                : null,
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
    revisionsIncluded: o.revisionsIncluded,
    requestId: o.requestId,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }
  }
}

export const orderService = new OrderService()
