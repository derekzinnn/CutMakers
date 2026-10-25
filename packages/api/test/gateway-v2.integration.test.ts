import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarEditor, criarPedido } from './fixtures'
import { paymentService } from '../src/services/payment.service'
import { subscriptionService } from '../src/services/subscription.service'
import { agreementService } from '../src/services/agreement.service'

/**
 * AbacatePay v2 contra um gateway SIMULADO (fetch substituído).
 *
 * Cobre o que não dá para testar contra o sandbox sem expor chave nem pagar de
 * verdade: o que o nosso código faz com cada resposta/evento. O formato do payload
 * de transparent.* e subscription.* não é documentado, então os testes mandam o id
 * em posições diferentes do JSON — o código tem que achá-lo em qualquer uma.
 */
const WEBHOOK_SECRET = 'segredo-gateway-teste'
const auth = { querySecret: WEBHOOK_SECRET }

interface GatewayState {
  pixStatus: string
  checkoutStatus: string
  failCreate: boolean
  pixExpiresAt: string
}

function instalarGateway() {
  const state: GatewayState = {
    pixStatus: 'PENDING',
    checkoutStatus: 'PENDING',
    failCreate: false,
    pixExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }
  const calls: { method: string; path: string; body?: any }[] = []
  let seq = 0
  const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data, error: null }), { status: 200 })

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url)
    const path = u.pathname.replace('/v2', '')
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method: init?.method ?? 'GET', path, body })

    if (path === '/transparents/create') {
      const n = ++seq
      return ok({
        id: `pix_char_gw${n}`,
        status: 'PENDING',
        brCode: `00020126BR${n}`,
        brCodeBase64: 'data:image/png;base64,AAAA',
        expiresAt: state.pixExpiresAt,
        devMode: true,
      })
    }
    if (path === '/transparents/check') {
      return ok({ id: u.searchParams.get('id'), status: state.pixStatus, brCode: null, brCodeBase64: null, expiresAt: null, devMode: true })
    }
    if (path === '/subscriptions/create') {
      if (state.failCreate) {
        return new Response(JSON.stringify({ success: false, data: null, error: 'Insufficient permissions' }), { status: 401 })
      }
      const n = ++seq
      return ok({ id: `bill_gw${n}`, url: `https://app.abacatepay.com/pay/bill_gw${n}`, status: 'PENDING', externalId: body.externalId })
    }
    if (path === '/subscriptions/checkouts/get') {
      return ok({ id: u.searchParams.get('id'), url: 'https://x', status: state.checkoutStatus, externalId: null })
    }
    throw new Error(`rota não simulada: ${path}`)
  })

  vi.stubGlobal('fetch', fetchMock)
  return { state, calls, count: (path: string) => calls.filter((c) => c.path === path).length }
}

let gw: ReturnType<typeof instalarGateway>

beforeEach(async () => {
  process.env.ABACATEPAY_API_KEY = 'abc_dev_teste'
  process.env.ABACATEPAY_PREMIUM_PRODUCT_ID = 'prod_teste'
  process.env.ABACATEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET
  delete process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY
  delete process.env.NODE_ENV
  gw = instalarGateway()
  await limparBanco()
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.ABACATEPAY_API_KEY
  delete process.env.ABACATEPAY_PREMIUM_PRODUCT_ID
})

// ─── Assinatura Premium ───────────────────────────────────────────────────────

describe('assinatura Premium — checkout hospedado', () => {
  it('cria o checkout do produto com ciclo, só cartão, e guarda a URL', async () => {
    const { user, profile } = await criarEditor()
    const r = await subscriptionService.createSubscription(user.id)

    expect(r.devConfirmed).toBe(false)
    expect(r.paymentUrl).toMatch(/^https:\/\/app\.abacatepay\.com\/pay\/bill_gw/)

    const req = gw.calls.find((c) => c.path === '/subscriptions/create')!
    expect(req.body.items).toEqual([{ id: 'prod_teste', quantity: 1 }])
    expect(req.body.methods).toEqual(['CARD'])

    const sub = await testPrisma.subscription.findFirstOrThrow({ where: { editorProfileId: profile.id } })
    expect(sub.status).toBe('PENDING')
    expect(sub.externalSubscriptionId).toMatch(/^bill_gw/)
    expect(sub.paymentUrl).toBe(r.paymentUrl)
    expect(req.body.externalId).toBe(sub.id) // o webhook reconcilia por aqui
  })

  it('segundo clique REABRE a mesma URL, sem novo checkout no gateway', async () => {
    const { user } = await criarEditor()
    const a = await subscriptionService.createSubscription(user.id)
    const b = await subscriptionService.createSubscription(user.id)
    expect(b.reopened).toBe(true)
    expect(b.paymentUrl).toBe(a.paymentUrl)
    expect(gw.count('/subscriptions/create')).toBe(1)
  })

  it('falha do gateway cancela a linha e o editor consegue tentar de novo', async () => {
    const { user, profile } = await criarEditor()
    gw.state.failCreate = true
    await expect(subscriptionService.createSubscription(user.id)).rejects.toThrow(/gateway/i)

    const sub = await testPrisma.subscription.findFirstOrThrow({ where: { editorProfileId: profile.id } })
    expect(sub.status).toBe('CANCELLED') // não fica uma PENDING vazia travando o botão

    gw.state.failCreate = false
    const retry = await subscriptionService.createSubscription(user.id)
    expect(retry.paymentUrl).toBeTruthy()
  })

  it('sem o id do produto configurado recusa e não deixa lixo PENDING', async () => {
    const { user, profile } = await criarEditor()
    delete process.env.ABACATEPAY_PREMIUM_PRODUCT_ID
    await expect(subscriptionService.createSubscription(user.id)).rejects.toThrow(/indisponível/i)
    const sub = await testPrisma.subscription.findFirstOrThrow({ where: { editorProfileId: profile.id } })
    expect(sub.status).toBe('CANCELLED')
    expect(gw.count('/subscriptions/create')).toBe(0)
  })

  it('ao voltar do checkout, getMySubscription pergunta ao gateway e ativa se foi pago', async () => {
    const { user } = await criarEditor()
    await subscriptionService.createSubscription(user.id)

    // ainda não pagou: segue pendente, com a cobrança para reabrir
    const antes = await subscriptionService.getMySubscription(user.id)
    expect(antes.isPremium).toBe(false)
    expect(antes.pendingCharge?.paymentUrl).toBeTruthy()

    gw.state.checkoutStatus = 'PAID' // pagou, webhook ainda não chegou
    const depois = await subscriptionService.getMySubscription(user.id)
    expect(depois.isPremium).toBe(true)
    expect(depois.subscription?.status).toBe('ACTIVE')
  })
})

describe('assinatura Premium — webhook', () => {
  async function pendente() {
    const { user, profile } = await criarEditor()
    await subscriptionService.createSubscription(user.id)
    const sub = await testPrisma.subscription.findFirstOrThrow({ where: { editorProfileId: profile.id } })
    return { user, profile, sub }
  }
  const evento = (event: string, data: unknown, id = `log_${Math.random().toString(36).slice(2)}`) =>
    JSON.stringify({ id, event, data })

  it('subscription.completed ativa (checkout confirmado na API) e guarda o subs_', async () => {
    const { sub, profile } = await pendente()
    gw.state.checkoutStatus = 'PAID'

    const corpo = evento('subscription.completed', {
      subscription: { id: 'subs_abc123' },
      checkout: { id: sub.externalSubscriptionId },
    })
    await paymentService.handleWebhook(corpo, auth)

    const depois = await testPrisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(depois.status).toBe('ACTIVE')
    expect(depois.gatewaySubscriptionId).toBe('subs_abc123')
    const prof = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(prof.isPremium).toBe(true)
  })

  it('NÃO confia no corpo: evento "completed" com checkout ainda PENDING no gateway não ativa', async () => {
    const { sub } = await pendente()
    gw.state.checkoutStatus = 'PENDING'
    await paymentService.handleWebhook(evento('subscription.completed', { checkout: { id: sub.externalSubscriptionId } }), auth)
    const depois = await testPrisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(depois.status).toBe('PENDING')
  })

  it('pagamento tardio (linha já CANCELLED por abandono) ainda ativa', async () => {
    const { sub } = await pendente()
    await testPrisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED' } })
    gw.state.checkoutStatus = 'PAID'
    await paymentService.handleWebhook(evento('subscription.completed', { id: sub.externalSubscriptionId }), auth)
    const depois = await testPrisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })
    expect(depois.status).toBe('ACTIVE')
  })

  it('replay de "completed" numa assinatura EXPIRADA não reativa o Premium', async () => {
    const { sub, profile } = await pendente()
    await testPrisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED', expiresAt: new Date(Date.now() - 86400_000) } })
    await testPrisma.editorProfile.update({ where: { id: profile.id }, data: { isPremium: false, premiumExpiresAt: null } })
    gw.state.checkoutStatus = 'PAID'

    await paymentService.handleWebhook(evento('subscription.completed', { id: sub.externalSubscriptionId }), auth)

    const prof = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(prof.isPremium).toBe(false)
  })

  it('subscription.renewed estende +30d a partir do vencimento atual', async () => {
    const { sub, profile } = await pendente()
    gw.state.checkoutStatus = 'PAID'
    await paymentService.handleWebhook(evento('subscription.completed', { sub: 'subs_ren1', b: sub.externalSubscriptionId }), auth)
    const ativo = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: profile.id } })
    const venc = ativo.premiumExpiresAt!.getTime()

    await paymentService.handleWebhook(evento('subscription.renewed', { subscription: { id: 'subs_ren1' } }, 'log_renova1'), auth)

    const depois = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(depois.premiumExpiresAt!.getTime() - venc).toBe(30 * 86400_000)
    const audit = await testPrisma.auditLog.count({ where: { action: 'SUBSCRIPTION_RENEWED' } })
    expect(audit).toBe(1)
  })

  it('o MESMO evento de renovação reentregue não estende duas vezes', async () => {
    const { sub, profile } = await pendente()
    gw.state.checkoutStatus = 'PAID'
    await paymentService.handleWebhook(evento('subscription.completed', { sub: 'subs_dup1', b: sub.externalSubscriptionId }), auth)

    const corpo = evento('subscription.renewed', { subscription: { id: 'subs_dup1' } }, 'log_mesmo')
    await paymentService.handleWebhook(corpo, auth)
    const uma = (await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: profile.id } })).premiumExpiresAt!.getTime()

    const reenvio = await paymentService.handleWebhook(corpo, auth)
    expect(reenvio).toMatchObject({ duplicate: true })
    const duas = (await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: profile.id } })).premiumExpiresAt!.getTime()
    expect(duas).toBe(uma)
  })

  it('renovação sem assinatura correspondente não derruba o webhook (200, com log)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await paymentService.handleWebhook(evento('subscription.renewed', { subscription: { id: 'subs_inexistente' } }), auth)
    expect(r).toEqual({ received: true })
    expect(spy).toHaveBeenCalled() // não pode sumir em silêncio: é cliente pagando sem receber
    spy.mockRestore()
  })

  it('subscription.cancelled registra mas o período já pago continua valendo', async () => {
    const { sub, profile } = await pendente()
    gw.state.checkoutStatus = 'PAID'
    await paymentService.handleWebhook(evento('subscription.completed', { sub: 'subs_can1', b: sub.externalSubscriptionId }), auth)

    await paymentService.handleWebhook(evento('subscription.cancelled', { subscription: { id: 'subs_can1' } }), auth)

    const prof = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(prof.isPremium).toBe(true)
    expect(await testPrisma.auditLog.count({ where: { action: 'SUBSCRIPTION_CANCELLED' } })).toBe(1)
  })

  it('assinatura recorrente NÃO pode ser "renovada" à mão (criaria cobrança em dobro)', async () => {
    const { user, sub, profile } = await pendente()
    gw.state.checkoutStatus = 'PAID'
    await paymentService.handleWebhook(evento('subscription.completed', { sub: 'subs_rec1', b: sub.externalSubscriptionId }), auth)
    expect((await testPrisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).recurring).toBe(true)

    // dentro da janela de renovação de 5 dias, onde antes o botão "Renovar" estava liberado
    await testPrisma.subscription.update({ where: { id: sub.id }, data: { expiresAt: new Date(Date.now() + 2 * 86400_000) } })
    await testPrisma.editorProfile.update({ where: { id: profile.id }, data: { premiumExpiresAt: new Date(Date.now() + 2 * 86400_000) } })

    await expect(subscriptionService.createSubscription(user.id)).rejects.toThrow(/renova automaticamente/i)
    expect(gw.count('/subscriptions/create')).toBe(1) // nenhum 2o checkout foi criado
  })

  it('cancelada no gateway deixa de ser recorrente: o editor pode reassinar no fim do período', async () => {
    const { user, sub, profile } = await pendente()
    gw.state.checkoutStatus = 'PAID'
    await paymentService.handleWebhook(evento('subscription.completed', { sub: 'subs_rec2', b: sub.externalSubscriptionId }), auth)
    await paymentService.handleWebhook(evento('subscription.cancelled', { subscription: { id: 'subs_rec2' } }), auth)
    expect((await testPrisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).recurring).toBe(false)

    await testPrisma.subscription.update({ where: { id: sub.id }, data: { expiresAt: new Date(Date.now() + 2 * 86400_000) } })
    await testPrisma.editorProfile.update({ where: { id: profile.id }, data: { premiumExpiresAt: new Date(Date.now() + 2 * 86400_000) } })

    const r = await subscriptionService.createSubscription(user.id)
    expect(r.paymentUrl).toBeTruthy()
  })

  it('reconcilePendingSubscriptions (cron) ativa o que o webhook perdeu, inclusive abandonadas', async () => {
    const { sub } = await pendente()
    await testPrisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED' } })
    gw.state.checkoutStatus = 'PAID'

    const r = await subscriptionService.reconcilePendingSubscriptions()
    expect(r.confirmed).toBe(1)
    expect((await testPrisma.subscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe('ACTIVE')
  })
})

// ─── PIX do pedido (escrow) ───────────────────────────────────────────────────

async function pedidoPronto() {
  const base = await criarPedido({ status: 'AWAITING_PAYMENT', budget: 250 })
  await agreementService.ensureAgreement(base.order.id)
  await agreementService.acceptAgreement(base.order.id, base.creator.id)
  await agreementService.acceptAgreement(base.order.id, base.editor.id)
  return base
}
const pixPago = (id: string) =>
  JSON.stringify({ id: 'log_pix', event: 'transparent.completed', data: { transparent: { id } } })

describe('PIX do pedido — transparente v2', () => {
  it('gera o PIX, guarda brCode/QR e deixa a transação PENDING', async () => {
    const { order, creator } = await pedidoPronto()
    const r = await paymentService.initiatePayment(order.id, creator.id)

    expect(r.paymentUrl).toBeNull() // não há página hospedada no PIX transparente
    expect(r.pixCode).toMatch(/^00020126BR/)
    expect(r.pixQrCode).toMatch(/^data:image\/png/)

    const req = gw.calls.find((c) => c.path === '/transparents/create')!
    expect(req.body.method).toBe('PIX')
    expect(req.body.data.amount).toBe(25000) // centavos
    expect(req.body.data.externalId).toBe(order.id)

    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(tx.status).toBe('PENDING')
    expect(tx.pixCode).toBe(r.pixCode)
    expect(tx.externalPaymentId).toMatch(/^pix_char_gw/)
  })

  it('reabrir o pagamento devolve o MESMO PIX, sem cobrança nova', async () => {
    const { order, creator } = await pedidoPronto()
    const a = await paymentService.initiatePayment(order.id, creator.id)
    const b = await paymentService.initiatePayment(order.id, creator.id)
    expect(b.pixCode).toBe(a.pixCode)
    expect(gw.count('/transparents/create')).toBe(1)
  })

  it('PIX expirado é substituído por outro NO MESMO registro (orderId é único)', async () => {
    const { order, creator } = await pedidoPronto()
    const a = await paymentService.initiatePayment(order.id, creator.id)
    await testPrisma.transaction.update({ where: { orderId: order.id }, data: { chargeExpiresAt: new Date(Date.now() - 1000) } })

    const b = await paymentService.initiatePayment(order.id, creator.id)
    expect(b.pixCode).not.toBe(a.pixCode)
    expect(gw.count('/transparents/create')).toBe(2)
    expect(await testPrisma.transaction.count({ where: { orderId: order.id } })).toBe(1)
    // a segunda cobrança não pode reaproveitar a externalId (idempotência do gateway devolveria a velha)
    const ids = gw.calls.filter((c) => c.path === '/transparents/create').map((c) => c.body.data.externalId)
    expect(new Set(ids).size).toBe(2)
  })

  it('pedido já pago continua barrado', async () => {
    const { order, creator } = await pedidoPronto()
    await paymentService.initiatePayment(order.id, creator.id)
    gw.state.pixStatus = 'PAID'
    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    await paymentService.handleWebhook(pixPago(tx.externalPaymentId!), auth)

    await expect(paymentService.initiatePayment(order.id, creator.id)).rejects.toThrow(/aguardando pagamento|já foi iniciado/i)
  })

  it('transparent.completed + gateway diz PAID → HELD e pedido IN_PROGRESS', async () => {
    const { order, creator } = await pedidoPronto()
    await paymentService.initiatePayment(order.id, creator.id)
    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })

    gw.state.pixStatus = 'PAID'
    await paymentService.handleWebhook(pixPago(tx.externalPaymentId!), auth)

    expect((await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('HELD')
    expect((await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('IN_PROGRESS')
  })

  it('NÃO confia no corpo: evento "pago" com o gateway ainda PENDING é ignorado', async () => {
    const { order, creator } = await pedidoPronto()
    await paymentService.initiatePayment(order.id, creator.id)
    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })

    gw.state.pixStatus = 'PENDING'
    const r = await paymentService.handleWebhook(pixPago(tx.externalPaymentId!), auth)

    expect(r).toMatchObject({ ignored: true })
    expect((await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('PENDING')
  })

  it('o id do gateway pode vir em qualquer ponto do payload', async () => {
    const { order, creator } = await pedidoPronto()
    await paymentService.initiatePayment(order.id, creator.id)
    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    gw.state.pixStatus = 'PAID'

    const corpo = JSON.stringify({ id: 'log_x', event: 'transparent.completed', data: { a: { b: [{ pixQrCode: { id: tx.externalPaymentId } }] } } })
    await paymentService.handleWebhook(corpo, auth)
    expect((await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('HELD')
  })

  it('reconcilePendingPayments (cron) confirma o PIX cujo webhook se perdeu', async () => {
    const { order, creator } = await pedidoPronto()
    await paymentService.initiatePayment(order.id, creator.id)
    gw.state.pixStatus = 'PAID'

    const r = await paymentService.reconcilePendingPayments()
    expect(r.confirmed).toBe(1)
    expect((await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('HELD')
    // rodar de novo não duplica
    expect((await paymentService.reconcilePendingPayments()).confirmed).toBe(0)
  })
})
