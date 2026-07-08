import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'
import { INCLUDED_REVISIONS } from './agreement.service'
import { logEvent } from './audit.service'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CreateRevisionData {
  deliveryId: string
  description: string
}

const revisionInclude = {
  delivery: { select: { id: true, version: true } },
  requestedBy: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.RevisionInclude

type RevisionWithRelations = Prisma.RevisionGetPayload<{ include: typeof revisionInclude }>

export function revisionToDTO(r: RevisionWithRelations) {
  return {
    id: r.id,
    orderId: r.orderId,
    description: r.description,
    status: r.status,
    deliveryId: r.deliveryId,
    deliveryVersion: r.delivery.version,
    createdAt: r.createdAt,
    requestedBy: {
      id: r.requestedBy.id,
      name: r.requestedBy.name,
      avatarUrl: r.requestedBy.avatarUrl,
    },
  }
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class RevisionService {
  async createRevision(orderId: string, requestedById: string, data: CreateRevisionData) {
    const description = data.description?.trim()
    if (!description) throw BadRequest('Descreva o que precisa ser alterado')

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, creatorId: true, editorId: true, status: true, title: true },
    })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.creatorId !== requestedById) {
      throw Forbidden('Apenas o creator do pedido pode solicitar revisão')
    }
    if (order.status !== 'DELIVERED') {
      throw BadRequest('Só é possível solicitar revisão de um pedido entregue')
    }

    // Cláusula 3b do contrato: até 2 rodadas de revisão inclusas
    const revisionCount = await prisma.revision.count({ where: { orderId } })
    if (revisionCount >= INCLUDED_REVISIONS) {
      throw BadRequest(
        `Limite de ${INCLUDED_REVISIONS} revisões inclusas atingido. Aprove a entrega ou abra uma disputa para análise da equipe.`,
      )
    }

    // A revisão precisa apontar para a entrega mais recente do pedido
    const latestDelivery = await prisma.delivery.findFirst({
      where: { orderId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true },
    })
    if (!latestDelivery) throw BadRequest('Este pedido ainda não possui entregas')
    if (latestDelivery.id !== data.deliveryId) {
      throw BadRequest('A revisão deve apontar para a entrega mais recente')
    }

    const revision = await prisma.$transaction(async (tx) => {
      const created = await tx.revision.create({
        data: {
          orderId,
          deliveryId: latestDelivery.id,
          requestedById,
          description,
          status: 'PENDING',
        },
        include: revisionInclude,
      })

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'REVISION_REQUESTED' },
      })

      await tx.notification.create({
        data: {
          userId: order.editorId,
          type: 'REVISION_REQUESTED',
          title: 'Revisão solicitada',
          body: `O creator solicitou revisão na entrega v${latestDelivery.version} de "${order.title}".`,
          relatedOrderId: orderId,
        },
      })

      return created
    })

    await logEvent({
      actorId: requestedById,
      action: 'REVISION_REQUESTED',
      entityType: 'Order',
      entityId: orderId,
      metadata: { deliveryVersion: latestDelivery.version },
    })

    return revisionToDTO(revision)
  }

  async listRevisions(orderId: string, userId: string, isAdmin: boolean) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { creatorId: true, editorId: true },
    })
    if (!order) throw NotFound('Pedido não encontrado')
    if (!isAdmin && order.creatorId !== userId && order.editorId !== userId) {
      throw Forbidden('Você não tem acesso a este pedido')
    }

    const revisions = await prisma.revision.findMany({
      where: { orderId },
      include: revisionInclude,
      orderBy: { createdAt: 'desc' },
    })

    return revisions.map(revisionToDTO)
  }

  // Marca revisões PENDING como ADDRESSED — chamado quando o editor envia nova entrega.
  // Retorna as operações prisma para compor numa transação externa (createDelivery).
  markAddressedOp(orderId: string) {
    return prisma.revision.updateMany({
      where: { orderId, status: 'PENDING' },
      data: { status: 'ADDRESSED' },
    })
  }
}

export const revisionService = new RevisionService()
