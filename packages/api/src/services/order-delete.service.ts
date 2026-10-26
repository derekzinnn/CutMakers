import { prisma } from '../lib/prisma'
import { ratingBandOf } from '../lib/plans'
import { hardDeleteEnabled } from '../lib/hard-delete'
import { Conflict, Forbidden, NotFound } from '../lib/errors'
import { logEvent } from './audit.service'

/**
 * Exclusão DEFINITIVA de um pedido — limpeza de dados de teste (mesma trava do usuário).
 *
 * Apaga o pedido e tudo que depende dele, na ordem das chaves estrangeiras, numa transação única.
 * Refaz o que o pedido concluído tinha alimentado (nota média e total de trabalhos do editor).
 *
 * Recusa pedido com cobrança REAL no gateway (HELD/RELEASED): o dinheiro existe, e apagar o
 * registro o faria sumir da contabilidade. Para isso há reembolso/disputa. Cobranças simuladas
 * (`dev_`/`demo_`) podem ser apagadas.
 */

const isSimulatedCharge = (id: string | null) => !id || id.startsWith('dev_') || id.startsWith('demo_')

export async function deleteOrder(adminId: string, orderId: string) {
  if (!hardDeleteEnabled()) {
    throw Forbidden('A exclusão de pedidos está desativada em produção.')
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      transaction: { select: { status: true, externalPaymentId: true } },
      review: { select: { id: true } },
      editor: { select: { editorProfile: { select: { id: true } } } },
    },
  })
  if (!order) throw NotFound('Pedido não encontrado')

  const tx0 = order.transaction
  if (tx0 && (tx0.status === 'HELD' || tx0.status === 'RELEASED') && !isSimulatedCharge(tx0.externalPaymentId)) {
    throw Conflict('Este pedido tem um pagamento real no gateway. Reembolse ou resolva por disputa em vez de excluir.')
  }

  await prisma.$transaction(
    async (tx) => {
      const conv = await tx.conversation.findUnique({ where: { orderId }, select: { id: true } })
      if (conv) {
        await tx.message.deleteMany({ where: { conversationId: conv.id } })
        await tx.conversation.delete({ where: { id: conv.id } })
      }

      // Revision antes de Delivery: aponta para ela
      await tx.revision.deleteMany({ where: { orderId } })
      await tx.delivery.deleteMany({ where: { orderId } })
      await tx.orderFile.deleteMany({ where: { orderId } })
      await tx.review.deleteMany({ where: { orderId } })
      await tx.transaction.deleteMany({ where: { orderId } })
      await tx.orderAgreement.deleteMany({ where: { orderId } })
      await tx.dispute.deleteMany({ where: { orderId } })
      await tx.orderProposal.deleteMany({ where: { orderId } })
      await tx.notification.deleteMany({ where: { relatedOrderId: orderId } })
      await tx.order.delete({ where: { id: orderId } })

      // A reputação do editor foi construída por este pedido: refaz a partir do que sobrou
      const profile = order.editor.editorProfile
      if (profile) {
        if (order.review) {
          const agg = await tx.review.aggregate({ where: { revieweeId: order.editorId }, _avg: { rating: true } })
          const media = agg._avg.rating ?? 0
          await tx.editorProfile.update({
            where: { id: profile.id },
            data: { avgRating: media, ratingBand: ratingBandOf(media) },
          })
        }
        if (order.status === 'COMPLETED') {
          await tx.editorProfile.updateMany({
            where: { id: profile.id, totalJobs: { gt: 0 } },
            data: { totalJobs: { decrement: 1 } },
          })
        }
      }
    },
    { timeout: 30_000, maxWait: 10_000 },
  )

  // A trilha é histórico: a linha de auditoria do pedido permanece e registra a exclusão
  await logEvent({
    actorId: adminId,
    action: 'ORDER_DELETED',
    entityType: 'Order',
    entityId: orderId,
    metadata: { title: order.title, status: order.status, budget: Number(order.budget) },
  })
}
