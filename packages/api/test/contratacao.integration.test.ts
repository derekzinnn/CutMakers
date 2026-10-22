import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarCategoria, criarCreator, criarEditor } from './fixtures'
import { orderService } from '../src/services/order.service'
import { proposalService } from '../src/services/proposal.service'
import { agreementService } from '../src/services/agreement.service'
import { paymentService } from '../src/services/payment.service'

/**
 * Fluxo de contratação de um editor, ponta a ponta, pelos services reais.
 *
 * É o caminho feliz que o produto inteiro gira em torno:
 *   criar pedido → aceitar proposta → ambos aceitam contrato → pagar (escrow)
 *   → entregar → aprovar → pagamento liberado ao editor.
 *
 * Roda SEM gateway (ABACATEPAY_API_KEY ausente): o initiatePayment cai no dev
 * mode, que confirma na hora. É exatamente o modo da demonstração de venda.
 */

beforeAll(() => {
  delete process.env.ABACATEPAY_API_KEY // garante dev mode (pagamento auto-confirma)
})
afterAll(() => {
  // nao recoloca a chave — o ambiente de teste nunca a tem
})
beforeEach(async () => {
  await limparBanco()
})

/** Monta criador + editor + categoria e devolve os ids. */
async function partes() {
  const categoria = await criarCategoria()
  const creator = await criarCreator()
  const { user: editor } = await criarEditor()
  return { categoriaId: categoria.id, creatorId: creator.id, editorId: editor.id }
}

describe('contratação de um editor — fluxo completo', () => {
  it('criar → aceitar proposta → contrato → pagar → entregar → aprovar → RELEASED', async () => {
    const { categoriaId, creatorId, editorId } = await partes()

    // 1) Criador cria o pedido. Nasce em NEGOTIATING com a 1a proposta do criador
    const pedido = await orderService.create(creatorId, {
      editorId,
      categoryId: categoriaId,
      title: 'Edição do meu vlog',
      description: 'Cortar 20min em 8min, legendas e trilha',
      budget: 300,
      files: [],
    })
    expect(pedido.status).toBe('NEGOTIATING')

    // O editor manda uma contraproposta
    const contra = await proposalService.create(pedido.id, editorId, 350, 'Fecho por 350 com 2 revisões')

    // 2) Criador aceita a proposta do editor → AWAITING_PAYMENT, budget atualizado
    await proposalService.accept(pedido.id, contra.id, creatorId, false)
    let atual = await testPrisma.order.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(atual.status).toBe('AWAITING_PAYMENT')
    expect(atual.budget.toString()).toBe('350')

    // 3) Gate de contrato: pagar ANTES de ambos aceitarem deve falhar
    await expect(paymentService.initiatePayment(pedido.id, creatorId)).rejects.toThrow(/aceitar os termos/i)

    // Ambas as partes aceitam o contrato
    await agreementService.acceptAgreement(pedido.id, creatorId)
    await agreementService.acceptAgreement(pedido.id, editorId)
    const contrato = await testPrisma.orderAgreement.findUniqueOrThrow({ where: { orderId: pedido.id } })
    expect(contrato.creatorAcceptedAt).not.toBeNull()
    expect(contrato.editorAcceptedAt).not.toBeNull()

    // 4) Pagamento (dev mode): escrow HELD + pedido → IN_PROGRESS
    await paymentService.initiatePayment(pedido.id, creatorId)
    atual = await testPrisma.order.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(atual.status).toBe('IN_PROGRESS')
    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: pedido.id } })
    expect(tx.status).toBe('HELD')
    expect(tx.amount.toString()).toBe('350')
    // taxa de 10% + líquido ao editor
    expect(tx.platformFee.toString()).toBe('35')
    expect(tx.netAmount.toString()).toBe('315')

    // 5) Editor entrega → DELIVERED
    await orderService.createDelivery(pedido.id, editorId, {
      videoUrl: 'https://res.cloudinary.com/demo/video/upload/entrega.mp4',
      message: 'Primeira versão',
    })
    atual = await testPrisma.order.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(atual.status).toBe('DELIVERED')

    // 6) Criador aprova → COMPLETED, escrow RELEASED, +1 trabalho do editor
    await orderService.updateStatus(pedido.id, creatorId, false, 'COMPLETED')
    atual = await testPrisma.order.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(atual.status).toBe('COMPLETED')
    const txFinal = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: pedido.id } })
    expect(txFinal.status).toBe('RELEASED')

    const profile = await testPrisma.editorProfile.findFirstOrThrow({ where: { userId: editorId } })
    expect(profile.totalJobs).toBe(1)
  })

  it('o fluxo deixa a trilha de auditoria completa', async () => {
    const { categoriaId, creatorId, editorId } = await partes()
    const pedido = await orderService.create(creatorId, {
      editorId, categoryId: categoriaId, title: 'Teste', description: 'x', budget: 200, files: [],
    })
    const prop = await testPrisma.orderProposal.findFirstOrThrow({ where: { orderId: pedido.id } })
    await proposalService.accept(pedido.id, prop.id, editorId, false) // editor aceita a do criador
    await agreementService.acceptAgreement(pedido.id, creatorId)
    await agreementService.acceptAgreement(pedido.id, editorId)
    await paymentService.initiatePayment(pedido.id, creatorId)
    await orderService.createDelivery(pedido.id, editorId, { videoUrl: 'https://cdn/e.mp4' })
    await orderService.updateStatus(pedido.id, creatorId, false, 'COMPLETED')

    const acoes = (await testPrisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })).map((a) => a.action)
    expect(acoes).toContain('ORDER_CREATED')
    expect(acoes).toContain('PROPOSAL_ACCEPTED')
    expect(acoes).toContain('PAYMENT_INITIATED')
    expect(acoes).toContain('PAYMENT_CONFIRMED') // dev mode confirma
    expect(acoes).toContain('PAYMENT_RELEASED')
  })

  it('criador não pode contratar a si mesmo', async () => {
    const categoria = await criarCategoria()
    const { user: editorBoth } = await criarEditor()

    await expect(
      orderService.create(editorBoth.id, {
        editorId: editorBoth.id,
        categoryId: categoria.id,
        title: 'x', description: 'y', budget: 100, files: [],
      }),
    ).rejects.toThrow(/para si mesmo/i)
  })

  it('não entrega antes de IN_PROGRESS (gate de pagamento)', async () => {
    const { categoriaId, creatorId, editorId } = await partes()
    const pedido = await orderService.create(creatorId, {
      editorId, categoryId: categoriaId, title: 'x', description: 'y', budget: 100, files: [],
    })
    // ainda em NEGOTIATING, sem pagamento
    await expect(
      orderService.createDelivery(pedido.id, editorId, { videoUrl: 'https://cdn/x.mp4' }),
    ).rejects.toThrow(/andamento/i)
  })
})
