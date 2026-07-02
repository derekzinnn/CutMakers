import { Dispute, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DisputeResolution = 'RELEASE' | 'REFUND'

export function disputeToDTO(d: Dispute) {
  return {
    id: d.id,
    orderId: d.orderId,
    reason: d.reason,
    resolution: d.resolution,
    status: d.status,
    openedById: d.openedById,
    resolvedById: d.resolvedById,
    createdAt: d.createdAt,
    resolvedAt: d.resolvedAt,
  }
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class DisputeService {
  async openDispute(orderId: string, userId: string, reason: string) {
    const trimmed = reason?.trim()
    if (!trimmed) throw BadRequest('Descreva o motivo da disputa')

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, creatorId: true, editorId: true, status: true, title: true, dispute: { select: { id: true } } },
    })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.creatorId !== userId) throw Forbidden('Apenas o creator do pedido pode abrir uma disputa')
    if (order.status !== 'DELIVERED' && order.status !== 'REVISION_REQUESTED') {
      throw BadRequest('Só é possível abrir disputa em pedidos entregues ou em revisão')
    }
    if (order.dispute) throw BadRequest('Já existe uma disputa aberta para este pedido')

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })

    const dispute = await prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: { orderId, openedById: userId, reason: trimmed, status: 'OPEN' },
      })

      await tx.order.update({ where: { id: orderId }, data: { status: 'DISPUTED' } })

      // Notifica o editor (contraparte)
      await tx.notification.create({
        data: {
          userId: order.editorId,
          type: 'DISPUTE_OPENED',
          title: 'Disputa aberta',
          body: `O creator abriu uma disputa no pedido "${order.title}". A CutMakers irá analisar.`,
          relatedOrderId: orderId,
        },
      })

      // Notifica todos os admins
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((a) => ({
            userId: a.id,
            type: 'DISPUTE_OPENED' as const,
            title: 'Nova disputa para análise',
            body: `Disputa aberta no pedido "${order.title}". Resolva liberando o pagamento ou reembolsando.`,
            relatedOrderId: orderId,
          })),
        })
      }

      return created
    })

    return disputeToDTO(dispute)
  }

  async resolveDispute(orderId: string, adminId: string, resolution: DisputeResolution) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        creatorId: true,
        editorId: true,
        status: true,
        title: true,
        dispute: true,
        transaction: { select: { id: true, status: true } },
      },
    })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.status !== 'DISPUTED') throw BadRequest('Pedido não está em disputa')
    if (!order.dispute || order.dispute.status !== 'OPEN') throw BadRequest('Disputa já foi resolvida')

    const isRelease = resolution === 'RELEASE'
    const newOrderStatus = isRelease ? 'COMPLETED' : 'CANCELLED'
    const newDisputeStatus = isRelease ? 'RESOLVED_RELEASED' : 'RESOLVED_REFUNDED'
    const resolutionText = isRelease
      ? 'Disputa resolvida a favor do editor — pagamento liberado'
      : 'Disputa resolvida a favor do creator — pagamento reembolsado'

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.order.update({ where: { id: orderId }, data: { status: newOrderStatus } }),
      prisma.dispute.update({
        where: { id: order.dispute.id },
        data: {
          status: newDisputeStatus,
          resolution: resolutionText,
          resolvedById: adminId,
          resolvedAt: new Date(),
        },
      }),
    ]

    // Movimenta o escrow apenas se houver transação retida
    if (order.transaction && order.transaction.status === 'HELD') {
      ops.push(
        prisma.transaction.update({
          where: { id: order.transaction.id },
          data: { status: isRelease ? 'RELEASED' : 'REFUNDED' },
        }),
      )
    }

    // Ao liberar, contabiliza o trabalho concluído do editor (mesmo efeito de COMPLETED)
    if (isRelease) {
      ops.push(
        prisma.editorProfile.updateMany({
          where: { userId: order.editorId },
          data: { totalJobs: { increment: 1 } },
        }),
      )
    }

    // Notifica ambas as partes do desfecho
    const outcomeForCreator = isRelease
      ? `A disputa do pedido "${order.title}" foi resolvida a favor do editor. O pagamento foi liberado.`
      : `A disputa do pedido "${order.title}" foi resolvida a seu favor. O valor será reembolsado.`
    const outcomeForEditor = isRelease
      ? `A disputa do pedido "${order.title}" foi resolvida a seu favor. O pagamento foi liberado.`
      : `A disputa do pedido "${order.title}" foi resolvida a favor do creator. O valor foi reembolsado.`

    ops.push(
      prisma.notification.create({
        data: {
          userId: order.creatorId,
          type: 'DISPUTE_RESOLVED',
          title: 'Disputa resolvida',
          body: outcomeForCreator,
          relatedOrderId: orderId,
        },
      }),
      prisma.notification.create({
        data: {
          userId: order.editorId,
          type: 'DISPUTE_RESOLVED',
          title: 'Disputa resolvida',
          body: outcomeForEditor,
          relatedOrderId: orderId,
        },
      }),
    )

    await prisma.$transaction(ops)

    const updated = await prisma.dispute.findUniqueOrThrow({ where: { id: order.dispute.id } })
    return disputeToDTO(updated)
  }
}

export const disputeService = new DisputeService()
