import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { createHmac } from 'crypto'
import { testPrisma, limparBanco } from './setup-integration'
import { criarPedido, criarTransacaoPendente } from './fixtures'
import { paymentService } from '../src/services/payment.service'

const SECRET = 'segredo-de-teste-integracao'
const assinar = (raw: string) => 'sha256=' + createHmac('sha256', SECRET).update(raw).digest('hex')
const eventoPago = (billingId: string) =>
  JSON.stringify({ event: 'billing.paid', data: { billing: { id: billingId } } })

beforeAll(() => {
  process.env.ABACATEPAY_WEBHOOK_SECRET = SECRET
  delete process.env.NODE_ENV
})
beforeEach(async () => {
  await limparBanco()
})

describe('webhook billing.paid — movimento do escrow', () => {
  it('confirma o pagamento: PENDING → HELD e pedido → IN_PROGRESS', async () => {
    const { order, creator, editor } = await criarPedido({ status: 'AWAITING_PAYMENT' })
    const ch = 'ch_confirma_1'
    await criarTransacaoPendente(order.id, creator.id, editor.id, ch)

    const corpo = eventoPago(ch)
    const res = await paymentService.handleWebhook(corpo, assinar(corpo))
    expect(res).toEqual({ received: true })

    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(tx.status).toBe('HELD')
    const depois = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(depois.status).toBe('IN_PROGRESS')

    // Editor notificado uma única vez
    const notifs = await testPrisma.notification.findMany({
      where: { userId: editor.id, type: 'PAYMENT_CONFIRMED' },
    })
    expect(notifs).toHaveLength(1)
  })

  it('REPLAY depois da liberação NÃO reverte RELEASED para HELD', async () => {
    // Este era o bug: o handler regravava HELD sem olhar o status atual, então um
    // reenvio do gateway após a aprovação "desliberava" o dinheiro e corrompia o
    // resumo financeiro do admin.
    const { order, creator, editor } = await criarPedido({ status: 'AWAITING_PAYMENT' })
    const ch = 'ch_replay_1'
    await criarTransacaoPendente(order.id, creator.id, editor.id, ch)
    const corpo = eventoPago(ch)

    await paymentService.handleWebhook(corpo, assinar(corpo))           // confirma
    await paymentService.releasePayment(order.id, creator.id)           // creator aprova

    const liberada = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(liberada.status).toBe('RELEASED')

    const replay = await paymentService.handleWebhook(corpo, assinar(corpo))
    expect(replay).toEqual({ received: true, duplicate: true })

    const final = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(final.status).toBe('RELEASED')   // continua liberada
  })

  it('reenvio simples não duplica notificação nem reprocessa', async () => {
    const { order, creator, editor } = await criarPedido({ status: 'AWAITING_PAYMENT' })
    const ch = 'ch_replay_2'
    await criarTransacaoPendente(order.id, creator.id, editor.id, ch)
    const corpo = eventoPago(ch)

    await paymentService.handleWebhook(corpo, assinar(corpo))
    const r2 = await paymentService.handleWebhook(corpo, assinar(corpo))
    const r3 = await paymentService.handleWebhook(corpo, assinar(corpo))

    expect(r2).toEqual({ received: true, duplicate: true })
    expect(r3).toEqual({ received: true, duplicate: true })

    const notifs = await testPrisma.notification.count({
      where: { userId: editor.id, type: 'PAYMENT_CONFIRMED' },
    })
    expect(notifs).toBe(1)

    // Um único evento de auditoria de confirmação
    const audit = await testPrisma.auditLog.count({ where: { action: 'PAYMENT_CONFIRMED' } })
    expect(audit).toBe(1)
  })

  it('entregas SIMULTÂNEAS do gateway: só uma processa (lock otimista)', async () => {
    const { order, creator, editor } = await criarPedido({ status: 'AWAITING_PAYMENT' })
    const ch = 'ch_corrida_1'
    await criarTransacaoPendente(order.id, creator.id, editor.id, ch)
    const corpo = eventoPago(ch)

    const resultados = await Promise.all([
      paymentService.handleWebhook(corpo, assinar(corpo)),
      paymentService.handleWebhook(corpo, assinar(corpo)),
      paymentService.handleWebhook(corpo, assinar(corpo)),
    ])

    const processaram = resultados.filter((r) => !('duplicate' in r && r.duplicate))
    expect(processaram).toHaveLength(1)

    const notifs = await testPrisma.notification.count({
      where: { userId: editor.id, type: 'PAYMENT_CONFIRMED' },
    })
    expect(notifs).toBe(1)
  })

  it('releasePayment só age sobre HELD — não libera o que está PENDING', async () => {
    const { order, creator, editor } = await criarPedido({ status: 'AWAITING_PAYMENT' })
    await criarTransacaoPendente(order.id, creator.id, editor.id, 'ch_pendente_1')

    await paymentService.releasePayment(order.id, creator.id)

    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(tx.status).toBe('PENDING')   // intocada: nunca entrou em custódia
  })
})
