import { prisma } from '../lib/prisma'
import { BadRequest, Forbidden, NotFound } from '../lib/errors'
import { logEvent } from './audit.service'
import { hardDeleteEnabled } from '../lib/hard-delete'

/**
 * Exclusão DEFINITIVA de usuário — só para desenvolvimento.
 *
 * Em produção isto seria um erro: pedidos, pagamentos e auditoria são registro financeiro e
 * jurídico (contrato com aceite eletrônico, escrow), e o certo é suspender (ban) e, se for o
 * caso, anonimizar por LGPD. Aqui o objetivo é limpar contas de teste, então apagamos TUDO que
 * depende do usuário, na ordem das chaves estrangeiras, numa transação única (ou apaga tudo,
 * ou nada).
 *
 * Travas: recusa em NODE_ENV=production (salvo ALLOW_USER_DELETION=true), recusa contas ADMIN e recusa o próprio admin.
 */



export async function deleteUser(adminId: string, targetId: string) {
  if (!hardDeleteEnabled()) {
    throw Forbidden('A exclusão de usuários está desativada em produção. Use a suspensão.')
  }
  if (adminId === targetId) throw BadRequest('Você não pode excluir a própria conta')

  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) throw NotFound('Usuário não encontrado')
  if (target.role === 'ADMIN') throw Forbidden('Contas de administrador não podem ser excluídas')

  await prisma.$transaction(
    async (tx) => {
      const orders = await tx.order.findMany({
        where: { OR: [{ creatorId: targetId }, { editorId: targetId }] },
        select: { id: true },
      })
      const orderIds = orders.map((o) => o.id)

      const ownRequests = await tx.projectRequest.findMany({ where: { creatorId: targetId }, select: { id: true } })
      const requestIds = ownRequests.map((r) => r.id)

      const conversations = await tx.conversation.findMany({
        where: { OR: [{ creatorId: targetId }, { editorId: targetId }, { orderId: { in: orderIds } }] },
        select: { id: true },
      })
      const conversationIds = conversations.map((c) => c.id)

      // Conversas e mensagens
      await tx.message.deleteMany({ where: { OR: [{ conversationId: { in: conversationIds } }, { senderId: targetId }] } })
      await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } })

      // Tudo que pende dos pedidos (Revision antes de Delivery: aponta para ela)
      await tx.revision.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { requestedById: targetId }] } })
      await tx.delivery.deleteMany({ where: { orderId: { in: orderIds } } })
      await tx.orderFile.deleteMany({ where: { orderId: { in: orderIds } } })
      await tx.review.deleteMany({
        where: { OR: [{ orderId: { in: orderIds } }, { reviewerId: targetId }, { revieweeId: targetId }] },
      })
      await tx.transaction.deleteMany({
        where: { OR: [{ orderId: { in: orderIds } }, { payerId: targetId }, { payeeId: targetId }] },
      })
      await tx.orderAgreement.deleteMany({ where: { orderId: { in: orderIds } } })
      await tx.dispute.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { openedById: targetId }] } })
      await tx.orderProposal.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { proposedBy: targetId }] } })

      // Notificações: as do usuário e as que apontam para o que será apagado
      await tx.notification.deleteMany({
        where: {
          OR: [
            { userId: targetId },
            { relatedOrderId: { in: orderIds } },
            { relatedRequestId: { in: requestIds } },
          ],
        },
      })

      await tx.order.deleteMany({ where: { id: { in: orderIds } } })

      // Solicitações do marketplace invertido
      await tx.requestProposal.deleteMany({ where: { OR: [{ requestId: { in: requestIds } }, { editorId: targetId }] } })
      await tx.projectRequest.deleteMany({ where: { id: { in: requestIds } } })

      // Perfil de editor: favoritos, categorias, portfólio, assinaturas
      const profile = await tx.editorProfile.findUnique({ where: { userId: targetId }, select: { id: true } })
      if (profile) {
        const portfolio = await tx.portfolioItem.findMany({ where: { editorProfileId: profile.id }, select: { id: true } })
        // Pedidos de OUTRAS pessoas que usaram um item deste portfólio só perdem a referência
        await tx.order.updateMany({
          where: { portfolioItemId: { in: portfolio.map((p) => p.id) } },
          data: { portfolioItemId: null },
        })
        await tx.favorite.deleteMany({ where: { editorProfileId: profile.id } })
        await tx.editorCategory.deleteMany({ where: { editorProfileId: profile.id } })
        await tx.portfolioItem.deleteMany({ where: { editorProfileId: profile.id } })
        await tx.subscription.deleteMany({ where: { editorProfileId: profile.id } })
        await tx.editorProfile.delete({ where: { id: profile.id } })
      }
      await tx.favorite.deleteMany({ where: { userId: targetId } })

      // Auditoria é histórico: mantém as linhas e só desvincula o ator (vira "Sistema")
      await tx.auditLog.updateMany({ where: { actorId: targetId }, data: { actorId: null } })

      await tx.user.delete({ where: { id: targetId } })
    },
    { timeout: 30_000, maxWait: 10_000 },
  )

  await logEvent({
    actorId: adminId,
    action: 'USER_DELETED',
    entityType: 'User',
    entityId: targetId,
    metadata: { name: target.name, email: target.email, role: target.role },
  })
}
