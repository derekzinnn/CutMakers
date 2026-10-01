import { Prisma, RequestProposal, RequestProposalStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest, Conflict } from '../lib/errors'
import { logEvent } from './audit.service'
import { agreementService } from './agreement.service'

// ─── Marketplace invertido ─────────────────────────────────────────────────────
// Creator publica uma ProjectRequest (OPEN) → editores enviam RequestProposals →
// creator aceita uma → nasce um Order já com editor, em AWAITING_PAYMENT, e o
// fluxo segue pelo pipeline existente (contrato → pagamento → entrega).

const PER_PAGE = 20
const PLATFORM_FEE_RATE = new Prisma.Decimal('0.10')
const DAY_MS = 24 * 60 * 60 * 1000
const PREVIEW_LENGTH = 200

// ─── Tipos de entrada ──────────────────────────────────────────────────────────

export interface CreateRequestData {
  categoryId: string
  title: string
  description: string
  budgetMin?: number
  budgetMax?: number
  deadline?: Date
  revisionsIncluded?: number
  referenceLinks?: string[]
}

export interface UpdateRequestData {
  title?: string
  description?: string
  budgetMin?: number | null
  budgetMax?: number | null
  deadline?: Date | null
  referenceLinks?: string[]
}

export interface ProposalData {
  amount: number
  deliveryDays: number
  message: string
}

export interface ListBoardParams {
  category?: string
  budgetMin?: number
  budgetMax?: number
  search?: string
  sort?: 'recent' | 'budget_desc'
  page?: number
}

export type ProposalSort = 'amount' | 'rating'

interface Requester {
  sub: string
  role: string
}

// ─── Includes tipados ──────────────────────────────────────────────────────────

const activeProposalsCount = {
  proposals: { where: { status: { not: RequestProposalStatus.WITHDRAWN } } },
}

const creatorListInclude = {
  category: { select: { id: true, name: true } },
  order: { select: { id: true, status: true } },
  _count: { select: activeProposalsCount },
} satisfies Prisma.ProjectRequestInclude

function boardInclude(editorId: string) {
  return {
    category: { select: { id: true, name: true } },
    creator: { select: { id: true, name: true, avatarUrl: true } },
    _count: { select: activeProposalsCount },
    // Só a proposta do próprio editor — nunca as dos concorrentes
    proposals: { where: { editorId }, select: { id: true, status: true } },
  } satisfies Prisma.ProjectRequestInclude
}

const creatorDetailInclude = {
  category: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true, avatarUrl: true } },
  order: { select: { id: true, status: true } },
  _count: { select: activeProposalsCount },
  proposals: {
    where: { status: { not: RequestProposalStatus.WITHDRAWN } },
    include: {
      editor: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          editorProfile: { select: { avgRating: true, totalJobs: true, isPremium: true } },
        },
      },
    },
  },
} satisfies Prisma.ProjectRequestInclude

const myProposalInclude = {
  request: {
    select: {
      id: true,
      title: true,
      status: true,
      category: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      order: { select: { id: true, editorId: true } },
    },
  },
} satisfies Prisma.RequestProposalInclude

type CreatorListItem = Prisma.ProjectRequestGetPayload<{ include: typeof creatorListInclude }>
type BoardItem = Prisma.ProjectRequestGetPayload<{ include: ReturnType<typeof boardInclude> }>
type CreatorDetail = Prisma.ProjectRequestGetPayload<{ include: typeof creatorDetailInclude }>
type MyProposalItem = Prisma.RequestProposalGetPayload<{ include: typeof myProposalInclude }>
type ProposalRow = RequestProposal

// ─── Helpers ───────────────────────────────────────────────────────────────────

const toNum = (d: Prisma.Decimal | null) => (d === null ? null : Number(d))

async function assertNotBanned(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { banned: true } })
  if (!user) throw NotFound('Usuário não encontrado')
  if (user.banned) throw Forbidden('Conta suspensa. Entre em contato com o suporte.')
}

function validateBudgetAndDeadline(
  budgetMin: number | null | undefined,
  budgetMax: number | null | undefined,
  deadline: Date | null | undefined,
) {
  if (budgetMin != null && budgetMax != null && budgetMin > budgetMax) {
    throw BadRequest('O orçamento mínimo não pode ser maior que o máximo')
  }
  if (deadline && deadline.getTime() <= Date.now()) {
    throw BadRequest('O prazo deve ser uma data futura')
  }
}

function closedRequestError(status: string) {
  return status === 'FILLED'
    ? BadRequest('Esta solicitação já foi fechada com um editor')
    : BadRequest('Esta solicitação foi cancelada')
}

function proposalToDTO(p: ProposalRow) {
  return {
    id: p.id,
    amount: Number(p.amount),
    deliveryDays: p.deliveryDays,
    message: p.message,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class ProjectRequestService {
  // ── Creator ─────────────────────────────────────────────────────────────────

  async createRequest(creatorId: string, data: CreateRequestData) {
    await assertNotBanned(creatorId)
    validateBudgetAndDeadline(data.budgetMin, data.budgetMax, data.deadline)

    const category = await prisma.category.findUnique({ where: { id: data.categoryId } })
    if (!category) throw BadRequest('Categoria não encontrada')

    const request = await prisma.projectRequest.create({
      data: {
        creatorId,
        categoryId: data.categoryId,
        title: data.title.trim(),
        description: data.description.trim(),
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        deadline: data.deadline,
        revisionsIncluded: data.revisionsIncluded ?? 2,
        referenceLinks: data.referenceLinks ?? [],
      },
      include: creatorListInclude,
    })

    await logEvent({
      actorId: creatorId,
      action: 'REQUEST_CREATED',
      entityType: 'ProjectRequest',
      entityId: request.id,
      metadata: { categoryId: data.categoryId, budgetMin: data.budgetMin ?? null, budgetMax: data.budgetMax ?? null },
    })

    return this.toCreatorListDTO(request, 0)
  }

  async listMine(creatorId: string, page = 1) {
    const currentPage = Math.max(page, 1)
    const where: Prisma.ProjectRequestWhereInput = { creatorId }

    const [requests, total, pendingTotal] = await Promise.all([
      prisma.projectRequest.findMany({
        where,
        skip: (currentPage - 1) * PER_PAGE,
        take: PER_PAGE,
        orderBy: { createdAt: 'desc' },
        include: creatorListInclude,
      }),
      prisma.projectRequest.count({ where }),
      // Badge da navegação: propostas aguardando decisão em solicitações abertas
      prisma.requestProposal.count({
        where: { status: 'PENDING', request: { creatorId, status: 'OPEN' } },
      }),
    ])

    const pendingByRequest = await prisma.requestProposal.groupBy({
      by: ['requestId'],
      where: { requestId: { in: requests.map((r) => r.id) }, status: 'PENDING' },
      _count: { _all: true },
    })
    const pendingMap = new Map(pendingByRequest.map((g) => [g.requestId, g._count._all]))

    return {
      requests: requests.map((r) => this.toCreatorListDTO(r, pendingMap.get(r.id) ?? 0)),
      pendingProposalsTotal: pendingTotal,
      total,
      page: currentPage,
      limit: PER_PAGE,
      totalPages: Math.ceil(total / PER_PAGE),
    }
  }

  async updateRequest(requestId: string, creatorId: string, data: UpdateRequestData) {
    const request = await prisma.projectRequest.findUnique({ where: { id: requestId } })
    if (!request) throw NotFound('Solicitação não encontrada')
    if (request.creatorId !== creatorId) throw Forbidden('Você não pode editar esta solicitação')
    if (request.status !== 'OPEN') throw closedRequestError(request.status)

    // Valida contra o estado final (valores enviados + atuais)
    const finalMin = data.budgetMin !== undefined ? data.budgetMin : toNum(request.budgetMin)
    const finalMax = data.budgetMax !== undefined ? data.budgetMax : toNum(request.budgetMax)
    validateBudgetAndDeadline(finalMin, finalMax, data.deadline)

    const updated = await prisma.projectRequest.update({
      where: { id: requestId },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.description !== undefined && { description: data.description.trim() }),
        ...(data.budgetMin !== undefined && { budgetMin: data.budgetMin }),
        ...(data.budgetMax !== undefined && { budgetMax: data.budgetMax }),
        ...(data.deadline !== undefined && { deadline: data.deadline }),
        ...(data.referenceLinks !== undefined && { referenceLinks: data.referenceLinks }),
      },
      include: creatorListInclude,
    })

    const pending = await prisma.requestProposal.count({ where: { requestId, status: 'PENDING' } })
    return this.toCreatorListDTO(updated, pending)
  }

  async cancelRequest(requestId: string, creatorId: string) {
    const request = await prisma.projectRequest.findUnique({ where: { id: requestId } })
    if (!request) throw NotFound('Solicitação não encontrada')
    if (request.creatorId !== creatorId) throw Forbidden('Você não pode cancelar esta solicitação')
    if (request.status !== 'OPEN') throw closedRequestError(request.status)

    const rejectedCount = await prisma.$transaction(async (tx) => {
      // Guard contra corrida (ex.: aceite simultâneo) — só cancela se ainda estiver OPEN
      const changed = await tx.projectRequest.updateMany({
        where: { id: requestId, status: 'OPEN' },
        data: { status: 'CANCELLED' },
      })
      if (changed.count === 0) throw Conflict('A solicitação mudou de estado. Atualize a página.')

      const pending = await tx.requestProposal.findMany({
        where: { requestId, status: 'PENDING' },
        select: { id: true, editorId: true },
      })
      if (pending.length > 0) {
        await tx.requestProposal.updateMany({
          where: { id: { in: pending.map((p) => p.id) } },
          data: { status: 'REJECTED' },
        })
        await tx.notification.createMany({
          data: pending.map((p) => ({
            userId: p.editorId,
            type: 'REQUEST_PROPOSAL_REJECTED' as const,
            title: 'Solicitação cancelada',
            body: `O criador cancelou a solicitação "${request.title}". Sua proposta foi encerrada.`,
            relatedRequestId: requestId,
          })),
        })
      }
      return pending.length
    })

    await logEvent({
      actorId: creatorId,
      action: 'REQUEST_CANCELLED',
      entityType: 'ProjectRequest',
      entityId: requestId,
      metadata: { rejectedProposals: rejectedCount },
    })

    return { id: requestId, status: 'CANCELLED' as const, rejectedProposals: rejectedCount }
  }

  /**
   * Núcleo do marketplace invertido: aceita uma proposta e materializa o Order.
   * Tudo numa única transação — Order + OrderProposal ACCEPTED + contrato +
   * fechamento da solicitação + rejeição das concorrentes + notificações.
   */
  async acceptProposal(requestId: string, proposalId: string, creatorId: string) {
    await assertNotBanned(creatorId)

    const result = await prisma.$transaction(
      async (tx) => {
        const request = await tx.projectRequest.findUnique({ where: { id: requestId } })
        if (!request) throw NotFound('Solicitação não encontrada')
        if (request.creatorId !== creatorId) throw Forbidden('Apenas o criador pode aceitar propostas')
        if (request.status !== 'OPEN') throw closedRequestError(request.status)

        const proposal = await tx.requestProposal.findUnique({ where: { id: proposalId } })
        if (!proposal || proposal.requestId !== requestId) throw NotFound('Proposta não encontrada')
        if (proposal.status !== 'PENDING') throw BadRequest('Esta proposta não está mais pendente')

        // Fecha a solicitação com guard otimista: se outro aceite ganhou a corrida, aborta
        const filled = await tx.projectRequest.updateMany({
          where: { id: requestId, status: 'OPEN' },
          data: { status: 'FILLED' },
        })
        if (filled.count === 0) throw Conflict('Esta solicitação já foi fechada')

        // Dinheiro sempre em Decimal — nada de float
        const amount = proposal.amount
        const platformFee = amount.mul(PLATFORM_FEE_RATE).toDecimalPlaces(2)
        const deadline = request.deadline ?? new Date(Date.now() + proposal.deliveryDays * DAY_MS)

        // Preço já acordado → pula NEGOTIATING e cai direto no gate de contrato/pagamento
        const order = await tx.order.create({
          data: {
            creatorId: request.creatorId,
            editorId: proposal.editorId,
            categoryId: request.categoryId,
            requestId,
            title: request.title,
            description: request.description,
            budget: amount,
            platformFee,
            status: 'AWAITING_PAYMENT',
            deadline,
            revisionsIncluded: request.revisionsIncluded,
          },
        })

        // Histórico de negociação consistente: a proposta vencedora vira um OrderProposal ACCEPTED
        await tx.orderProposal.create({
          data: {
            orderId: order.id,
            proposedBy: proposal.editorId,
            amount,
            message: proposal.message,
            status: 'ACCEPTED',
          },
        })

        // Contrato gerado no exato momento em que o editor passa a existir no pedido
        await agreementService.ensureAgreement(order.id, tx)

        await tx.requestProposal.update({ where: { id: proposalId }, data: { status: 'ACCEPTED' } })

        const losers = await tx.requestProposal.findMany({
          where: { requestId, status: 'PENDING', id: { not: proposalId } },
          select: { id: true, editorId: true },
        })
        if (losers.length > 0) {
          await tx.requestProposal.updateMany({
            where: { id: { in: losers.map((l) => l.id) } },
            data: { status: 'REJECTED' },
          })
          await tx.notification.createMany({
            data: losers.map((l) => ({
              userId: l.editorId,
              type: 'REQUEST_PROPOSAL_REJECTED' as const,
              title: 'Proposta não selecionada',
              body: `O projeto "${request.title}" foi fechado com outro editor.`,
              relatedRequestId: requestId,
            })),
          })
        }

        await tx.notification.create({
          data: {
            userId: proposal.editorId,
            type: 'REQUEST_PROPOSAL_ACCEPTED',
            title: 'Sua proposta foi aceita! 🎉',
            body: `Você foi escolhido para "${request.title}". Aceite o contrato para o projeto seguir para pagamento.`,
            relatedOrderId: order.id,
            relatedRequestId: requestId,
          },
        })

        return {
          orderId: order.id,
          amount: Number(amount),
          platformFee: Number(platformFee),
          rejectedCount: losers.length,
        }
      },
      { maxWait: 10_000, timeout: 20_000 },
    )

    await logEvent({
      actorId: creatorId,
      action: 'REQUEST_PROPOSAL_ACCEPTED',
      entityType: 'RequestProposal',
      entityId: proposalId,
      metadata: {
        amount: result.amount,
        platformFee: result.platformFee,
        requestId,
        orderId: result.orderId,
      },
    })
    await logEvent({
      actorId: creatorId,
      action: 'ORDER_CREATED',
      entityType: 'Order',
      entityId: result.orderId,
      metadata: { requestId, amount: result.amount },
    })

    return result
  }

  async rejectProposal(requestId: string, proposalId: string, creatorId: string) {
    const request = await prisma.projectRequest.findUnique({ where: { id: requestId } })
    if (!request) throw NotFound('Solicitação não encontrada')
    if (request.creatorId !== creatorId) throw Forbidden('Apenas o criador pode recusar propostas')
    if (request.status !== 'OPEN') throw closedRequestError(request.status)

    const proposal = await prisma.requestProposal.findUnique({ where: { id: proposalId } })
    if (!proposal || proposal.requestId !== requestId) throw NotFound('Proposta não encontrada')
    if (proposal.status !== 'PENDING') throw BadRequest('Esta proposta não está mais pendente')

    const [updated] = await prisma.$transaction([
      prisma.requestProposal.update({ where: { id: proposalId }, data: { status: 'REJECTED' } }),
      prisma.notification.create({
        data: {
          userId: proposal.editorId,
          type: 'REQUEST_PROPOSAL_REJECTED',
          title: 'Proposta recusada',
          body: `O criador recusou sua proposta para "${request.title}".`,
          relatedRequestId: requestId,
        },
      }),
    ])

    return proposalToDTO(updated)
  }

  // ── Detalhe (creator e editor) ─────────────────────────────────────────────

  async getRequest(requestId: string, requester: Requester, sort: ProposalSort = 'amount') {
    const isAdmin = requester.role === 'ADMIN'

    const head = await prisma.projectRequest.findUnique({
      where: { id: requestId },
      select: { creatorId: true, status: true },
    })
    if (!head) throw NotFound('Solicitação não encontrada')

    // Visão do criador (ou admin): todas as propostas com dados públicos do editor
    if (head.creatorId === requester.sub || isAdmin) {
      const request = await prisma.projectRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: creatorDetailInclude,
      })
      return { perspective: 'creator' as const, request: this.toCreatorDetailDTO(request, sort) }
    }

    // Visão do editor
    if (requester.role !== 'EDITOR' && requester.role !== 'BOTH') {
      throw Forbidden('Você não tem acesso a esta solicitação')
    }

    const request = await prisma.projectRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: {
        category: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: activeProposalsCount },
        proposals: { where: { editorId: requester.sub } },
      },
    })

    const myProposal = request.proposals[0] ?? null
    // Solicitações fechadas só continuam visíveis para quem participou
    if (request.status !== 'OPEN' && !myProposal) {
      throw NotFound('Solicitação não encontrada')
    }

    return {
      perspective: 'editor' as const,
      request: {
        id: request.id,
        title: request.title,
        description: request.description,
        referenceLinks: request.referenceLinks,
        category: request.category,
        creator: request.creator,
        budgetMin: toNum(request.budgetMin),
        budgetMax: toNum(request.budgetMax),
        deadline: request.deadline,
        revisionsIncluded: request.revisionsIncluded,
        status: request.status,
        proposalCount: request._count.proposals,
        myProposal: myProposal ? proposalToDTO(myProposal) : null,
        createdAt: request.createdAt,
      },
    }
  }

  // ── Editor ──────────────────────────────────────────────────────────────────

  async listOpen(editorId: string, params: ListBoardParams) {
    const currentPage = Math.max(params.page ?? 1, 1)

    const and: Prisma.ProjectRequestWhereInput[] = [
      { status: 'OPEN' },
      // BOTH: não mostra as solicitações que o próprio usuário publicou
      { creatorId: { not: editorId } },
    ]
    if (params.category) and.push({ categoryId: params.category })
    if (params.search) {
      and.push({
        OR: [
          { title: { contains: params.search, mode: 'insensitive' } },
          { description: { contains: params.search, mode: 'insensitive' } },
        ],
      })
    }
    // Sobreposição de faixas: a faixa da solicitação precisa tocar a faixa do filtro
    if (params.budgetMin !== undefined) {
      and.push({ OR: [{ budgetMax: null }, { budgetMax: { gte: params.budgetMin } }] })
    }
    if (params.budgetMax !== undefined) {
      and.push({ OR: [{ budgetMin: null }, { budgetMin: { lte: params.budgetMax } }] })
    }
    const where: Prisma.ProjectRequestWhereInput = { AND: and }

    const orderBy: Prisma.ProjectRequestOrderByWithRelationInput[] =
      params.sort === 'budget_desc'
        ? [{ budgetMax: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
        : [{ createdAt: 'desc' }]

    const [requests, total] = await Promise.all([
      prisma.projectRequest.findMany({
        where,
        skip: (currentPage - 1) * PER_PAGE,
        take: PER_PAGE,
        orderBy,
        include: boardInclude(editorId),
      }),
      prisma.projectRequest.count({ where }),
    ])

    return {
      requests: requests.map((r) => this.toBoardDTO(r)),
      total,
      page: currentPage,
      limit: PER_PAGE,
      totalPages: Math.ceil(total / PER_PAGE),
    }
  }

  async sendProposal(requestId: string, editorId: string, data: ProposalData) {
    await assertNotBanned(editorId)
    if (data.amount <= 0) throw BadRequest('O valor da proposta deve ser maior que zero')

    const request = await prisma.projectRequest.findUnique({ where: { id: requestId } })
    if (!request) throw NotFound('Solicitação não encontrada')
    if (request.status !== 'OPEN') throw closedRequestError(request.status)
    if (request.creatorId === editorId) {
      throw Forbidden('Você não pode enviar proposta para a sua própria solicitação')
    }

    const existing = await prisma.requestProposal.findUnique({
      where: { requestId_editorId: { requestId, editorId } },
    })

    let proposal: ProposalRow
    if (existing) {
      // Retirada não conta como "ativa": o editor pode voltar a propor reaproveitando a linha
      if (existing.status !== 'WITHDRAWN') {
        throw Conflict('Você já enviou uma proposta para esta solicitação. Edite a proposta existente.')
      }
      proposal = await prisma.requestProposal.update({
        where: { id: existing.id },
        data: { amount: data.amount, deliveryDays: data.deliveryDays, message: data.message.trim(), status: 'PENDING' },
      })
    } else {
      try {
        proposal = await prisma.requestProposal.create({
          data: {
            requestId,
            editorId,
            amount: data.amount,
            deliveryDays: data.deliveryDays,
            message: data.message.trim(),
          },
        })
      } catch (err) {
        // Corrida entre dois envios simultâneos → unique([requestId, editorId])
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw Conflict('Você já enviou uma proposta para esta solicitação.')
        }
        throw err
      }
    }

    const editor = await prisma.user.findUnique({ where: { id: editorId }, select: { name: true } })
    await prisma.notification.create({
      data: {
        userId: request.creatorId,
        type: 'REQUEST_PROPOSAL_RECEIVED',
        title: 'Nova proposta na sua solicitação',
        body: `${editor?.name ?? 'Um editor'} propôs R$ ${data.amount.toFixed(2)} para "${request.title}".`,
        relatedRequestId: requestId,
      },
    })

    await logEvent({
      actorId: editorId,
      action: 'REQUEST_PROPOSAL_SENT',
      entityType: 'RequestProposal',
      entityId: proposal.id,
      metadata: { requestId, amount: data.amount, deliveryDays: data.deliveryDays },
    })

    return proposalToDTO(proposal)
  }

  async updateMyProposal(requestId: string, editorId: string, data: Partial<ProposalData>) {
    const proposal = await this.getOwnPendingProposal(requestId, editorId)
    if (data.amount !== undefined && data.amount <= 0) {
      throw BadRequest('O valor da proposta deve ser maior que zero')
    }

    const updated = await prisma.requestProposal.update({
      where: { id: proposal.id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.deliveryDays !== undefined && { deliveryDays: data.deliveryDays }),
        ...(data.message !== undefined && { message: data.message.trim() }),
      },
    })
    return proposalToDTO(updated)
  }

  async withdrawMyProposal(requestId: string, editorId: string) {
    const proposal = await this.getOwnPendingProposal(requestId, editorId)
    const updated = await prisma.requestProposal.update({
      where: { id: proposal.id },
      data: { status: 'WITHDRAWN' },
    })
    return proposalToDTO(updated)
  }

  async listMyProposals(editorId: string, page = 1) {
    const currentPage = Math.max(page, 1)
    const where: Prisma.RequestProposalWhereInput = { editorId }

    const [proposals, total] = await Promise.all([
      prisma.requestProposal.findMany({
        where,
        skip: (currentPage - 1) * PER_PAGE,
        take: PER_PAGE,
        orderBy: { updatedAt: 'desc' },
        include: myProposalInclude,
      }),
      prisma.requestProposal.count({ where }),
    ])

    return {
      proposals: proposals.map((p) => this.toMyProposalDTO(p, editorId)),
      total,
      page: currentPage,
      limit: PER_PAGE,
      totalPages: Math.ceil(total / PER_PAGE),
    }
  }

  // ── Internos ────────────────────────────────────────────────────────────────

  private async getOwnPendingProposal(requestId: string, editorId: string) {
    const proposal = await prisma.requestProposal.findUnique({
      where: { requestId_editorId: { requestId, editorId } },
      include: { request: { select: { status: true } } },
    })
    if (!proposal) throw NotFound('Você não tem proposta nesta solicitação')
    if (proposal.request.status !== 'OPEN') throw closedRequestError(proposal.request.status)
    if (proposal.status !== 'PENDING') throw BadRequest('Só é possível alterar propostas pendentes')
    return proposal
  }

  // ── DTOs ────────────────────────────────────────────────────────────────────

  private toCreatorListDTO(r: CreatorListItem, pendingCount: number) {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      budgetMin: toNum(r.budgetMin),
      budgetMax: toNum(r.budgetMax),
      deadline: r.deadline,
      revisionsIncluded: r.revisionsIncluded,
      referenceLinks: r.referenceLinks,
      status: r.status,
      proposalCount: r._count.proposals,
      pendingProposalCount: pendingCount,
      orderId: r.order?.id ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }

  private toBoardDTO(r: BoardItem) {
    const mine = r.proposals[0] ?? null
    return {
      id: r.id,
      title: r.title,
      // Lista mostra só um preview — descrição completa e links ficam no detalhe.
      // Nenhuma URL de arquivo é exposta neste DTO (arquivos só após IN_PROGRESS no pedido).
      descriptionPreview:
        r.description.length > PREVIEW_LENGTH ? `${r.description.slice(0, PREVIEW_LENGTH).trimEnd()}…` : r.description,
      category: r.category,
      creator: { id: r.creator.id, name: r.creator.name, avatarUrl: r.creator.avatarUrl },
      budgetMin: toNum(r.budgetMin),
      budgetMax: toNum(r.budgetMax),
      deadline: r.deadline,
      revisionsIncluded: r.revisionsIncluded,
      proposalCount: r._count.proposals,
      myProposal: mine && mine.status !== 'WITHDRAWN' ? { status: mine.status } : null,
      createdAt: r.createdAt,
    }
  }

  private toCreatorDetailDTO(r: CreatorDetail, sort: ProposalSort) {
    const proposals = r.proposals.map((p) => ({
      ...proposalToDTO(p),
      editor: {
        id: p.editor.id,
        name: p.editor.name,
        avatarUrl: p.editor.avatarUrl,
        avgRating: p.editor.editorProfile?.avgRating ?? 0,
        totalJobs: p.editor.editorProfile?.totalJobs ?? 0,
        isPremium: p.editor.editorProfile?.isPremium ?? false,
      },
    }))

    // Pendentes primeiro; dentro de cada grupo, menor preço (default) ou melhor nota
    const statusRank = (s: string) => (s === 'PENDING' ? 0 : s === 'ACCEPTED' ? 1 : 2)
    proposals.sort((a, b) => {
      const rank = statusRank(a.status) - statusRank(b.status)
      if (rank !== 0) return rank
      return sort === 'rating'
        ? b.editor.avgRating - a.editor.avgRating || a.amount - b.amount
        : a.amount - b.amount
    })

    return {
      id: r.id,
      title: r.title,
      description: r.description,
      referenceLinks: r.referenceLinks,
      category: r.category,
      creator: r.creator,
      budgetMin: toNum(r.budgetMin),
      budgetMax: toNum(r.budgetMax),
      deadline: r.deadline,
      revisionsIncluded: r.revisionsIncluded,
      status: r.status,
      proposalCount: r._count.proposals,
      orderId: r.order?.id ?? null,
      proposals,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }

  private toMyProposalDTO(p: MyProposalItem, editorId: string) {
    const order = p.request.order
    return {
      ...proposalToDTO(p),
      request: {
        id: p.request.id,
        title: p.request.title,
        status: p.request.status,
        category: p.request.category,
        creatorName: p.request.creator.name,
      },
      // Só expõe o pedido para o editor vencedor
      orderId: order && order.editorId === editorId ? order.id : null,
    }
  }
}

export const projectRequestService = new ProjectRequestService()
