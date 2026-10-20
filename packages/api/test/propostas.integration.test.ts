import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarPedido } from './fixtures'
import { proposalService } from '../src/services/proposal.service'

beforeEach(async () => {
  await limparBanco()
})

/** Cria um pedido em NEGOTIATING com uma proposta PENDING do editor. */
async function pedidoComProposta(amount = 300) {
  const ctx = await criarPedido({ status: 'NEGOTIATING' })
  const proposta = await testPrisma.orderProposal.create({
    data: { orderId: ctx.order.id, proposedBy: ctx.editor.id, amount, status: 'PENDING' },
  })
  return { ...ctx, proposta }
}

describe('aceite de proposta sob concorrência', () => {
  it('dois cliques em "Aceitar" → um passa, o outro recebe 409', async () => {
    const { order, creator, proposta } = await pedidoComProposta()

    const res = await Promise.allSettled([
      proposalService.accept(order.id, proposta.id, creator.id, false),
      proposalService.accept(order.id, proposta.id, creator.id, false),
    ])

    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejeitado = res.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(rejeitado.reason).toMatchObject({ status: 409 })
  })

  it('não duplica notificação nem regenera o contrato duas vezes', async () => {
    const { order, creator, proposta } = await pedidoComProposta()

    await Promise.allSettled([
      proposalService.accept(order.id, proposta.id, creator.id, false),
      proposalService.accept(order.id, proposta.id, creator.id, false),
      proposalService.accept(order.id, proposta.id, creator.id, false),
    ])

    // Uma notificação para cada parte, não duas ou três
    const notifs = await testPrisma.notification.count({
      where: { relatedOrderId: order.id, type: 'PROPOSAL_ACCEPTED' },
    })
    expect(notifs).toBe(2)

    // Um único contrato (regenerateAgreement apaga e recria — rodar duas vezes
    // zeraria aceites já registrados)
    const contratos = await testPrisma.orderAgreement.count({ where: { orderId: order.id } })
    expect(contratos).toBe(1)
  })

  it('grava budget e taxa em Decimal, sem erro de float', async () => {
    const { order, creator, proposta } = await pedidoComProposta(199.99)

    await proposalService.accept(order.id, proposta.id, creator.id, false)

    const atualizado = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(atualizado.status).toBe('AWAITING_PAYMENT')
    expect(atualizado.budget.toString()).toBe('199.99')
    expect(atualizado.platformFee.toString()).toBe('20')   // 10% arredondado a 2 casas
    // taxa + líquido fecham no valor cheio
    const liquido = atualizado.budget.minus(atualizado.platformFee)
    expect(liquido.plus(atualizado.platformFee).toString()).toBe('199.99')
  })

  it('recusa simultânea também só passa uma vez', async () => {
    const { order, creator, proposta } = await pedidoComProposta()

    const res = await Promise.allSettled([
      proposalService.reject(order.id, proposta.id, creator.id, false),
      proposalService.reject(order.id, proposta.id, creator.id, false),
    ])

    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1)

    const notifs = await testPrisma.notification.count({
      where: { relatedOrderId: order.id, type: 'PROPOSAL_REJECTED' },
    })
    expect(notifs).toBe(1)

    // Recusar mantém o pedido em negociação
    const atualizado = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(atualizado.status).toBe('NEGOTIATING')
  })

  it('o proponente não pode aceitar a própria proposta', async () => {
    const { order, editor, proposta } = await pedidoComProposta()

    await expect(
      proposalService.accept(order.id, proposta.id, editor.id, false),
    ).rejects.toMatchObject({ status: 403 })
  })
})
