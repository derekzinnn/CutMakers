import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'

const PLATFORM_FEE_RATE = 0.1

const proposalInclude = {
  user: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.OrderProposalInclude

type ProposalWithUser = Prisma.OrderProposalGetPayload<{ include: typeof proposalInclude }>

export function proposalToDTO(p: ProposalWithUser) {
  const amount = Number(p.amount)
  const platformFee = Math.round(amount * PLATFORM_FEE_RATE * 100) / 100
  const netAmount = Math.round((amount - platformFee) * 100) / 100
  return {
    id: p.id,
    orderId: p.orderId,
    proposedBy: p.proposedBy,
    user: { id: p.user.id, name: p.user.name, avatarUrl: p.user.avatarUrl },
    amount,
    platformFee,
    netAmount,
    message: p.message,
    status: p.status,
    createdAt: p.createdAt,
  }
}

export class ProposalService {
  async create(orderId: string, userId: string, amount: number, message?: string) {
    if (amount <= 0) throw BadRequest('Valor deve ser positivo')

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, creatorId: true, editorId: true, status: true, title: true },
    })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.status !== 'NEGOTIATING') throw BadRequest('Pedido não está em fase de negociação')

    const isCreator = order.creatorId === userId
    const isEditor = order.editorId === userId
    if (!isCreator && !isEditor) throw Forbidden('Você não faz parte deste pedido')

    const existingPending = await prisma.orderProposal.findFirst({
      where: { orderId, status: 'PENDING' },
    })

    if (existingPending) {
      if (existingPending.proposedBy === userId) {
        throw BadRequest('Aguarde a contraparte responder antes de fazer outra proposta')
      }
      await prisma.orderProposal.update({
        where: { id: existingPending.id },
        data: { status: 'COUNTERED' },
      })
    }

    const proposal = await prisma.orderProposal.create({
      data: { orderId, proposedBy: userId, amount, message, status: 'PENDING' },
      include: proposalInclude,
    })

    const otherId = isCreator ? order.editorId : order.creatorId
    const proposerLabel = isCreator ? 'Creator' : 'Editor'

    await prisma.notification.create({
      data: {
        userId: otherId,
        type: 'PROPOSAL_RECEIVED',
        title: 'Nova proposta recebida',
        body: `${proposerLabel} enviou uma proposta de R$ ${amount.toFixed(2)} para "${order.title}"`,
        relatedOrderId: orderId,
      },
    })

    return proposalToDTO(proposal)
  }

  async list(orderId: string, userId: string, isAdmin: boolean) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { creatorId: true, editorId: true },
    })
    if (!order) throw NotFound('Pedido não encontrado')
    if (!isAdmin && order.creatorId !== userId && order.editorId !== userId) {
      throw Forbidden('Você não tem acesso a este pedido')
    }

    const proposals = await prisma.orderProposal.findMany({
      where: { orderId },
      include: proposalInclude,
      orderBy: { createdAt: 'asc' },
    })

    return proposals.map(proposalToDTO)
  }

  async accept(orderId: string, proposalId: string, userId: string, isAdmin: boolean) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, creatorId: true, editorId: true, status: true, title: true },
    })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.status !== 'NEGOTIATING') throw BadRequest('Pedido não está em fase de negociação')

    if (!isAdmin && order.creatorId !== userId && order.editorId !== userId) {
      throw Forbidden('Você não tem acesso a este pedido')
    }

    const proposal = await prisma.orderProposal.findFirst({
      where: { id: proposalId, orderId, status: 'PENDING' },
      include: proposalInclude,
    })
    if (!proposal) throw NotFound('Proposta não encontrada ou já respondida')

    if (!isAdmin && proposal.proposedBy === userId) {
      throw Forbidden('Você não pode aceitar a própria proposta')
    }

    const amount = Number(proposal.amount)
    const platformFee = Math.round(amount * PLATFORM_FEE_RATE * 100) / 100

    const [updatedProposal] = await prisma.$transaction([
      prisma.orderProposal.update({
        where: { id: proposalId },
        data: { status: 'ACCEPTED' },
        include: proposalInclude,
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { status: 'AWAITING_PAYMENT', budget: amount, platformFee },
      }),
      prisma.notification.create({
        data: {
          userId: order.creatorId,
          type: 'PROPOSAL_ACCEPTED',
          title: 'Proposta aceita!',
          body: `Proposta de R$ ${amount.toFixed(2)} aceita para "${order.title}". Realize o pagamento para iniciar o projeto.`,
          relatedOrderId: orderId,
        },
      }),
      prisma.notification.create({
        data: {
          userId: order.editorId,
          type: 'PROPOSAL_ACCEPTED',
          title: 'Proposta aceita!',
          body: `Proposta de R$ ${amount.toFixed(2)} aceita para "${order.title}". Aguardando pagamento do creator.`,
          relatedOrderId: orderId,
        },
      }),
    ])

    return proposalToDTO(updatedProposal)
  }

  async reject(orderId: string, proposalId: string, userId: string, isAdmin: boolean) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, creatorId: true, editorId: true, status: true, title: true },
    })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.status !== 'NEGOTIATING') throw BadRequest('Pedido não está em fase de negociação')

    if (!isAdmin && order.creatorId !== userId && order.editorId !== userId) {
      throw Forbidden('Você não tem acesso a este pedido')
    }

    const proposal = await prisma.orderProposal.findFirst({
      where: { id: proposalId, orderId, status: 'PENDING' },
      include: proposalInclude,
    })
    if (!proposal) throw NotFound('Proposta não encontrada ou já respondida')

    if (!isAdmin && proposal.proposedBy === userId) {
      throw Forbidden('Você não pode rejeitar a própria proposta')
    }

    const amount = Number(proposal.amount)
    const updated = await prisma.orderProposal.update({
      where: { id: proposalId },
      data: { status: 'REJECTED' },
      include: proposalInclude,
    })

    await prisma.notification.create({
      data: {
        userId: proposal.proposedBy,
        type: 'PROPOSAL_REJECTED',
        title: 'Proposta rejeitada',
        body: `Sua proposta de R$ ${amount.toFixed(2)} foi rejeitada. Envie uma nova oferta para "${order.title}".`,
        relatedOrderId: orderId,
      },
    })

    return proposalToDTO(updated)
  }
}

export const proposalService = new ProposalService()
