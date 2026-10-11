import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { createHmac } from 'crypto'
import { PaymentService } from './payment.service'

/**
 * Regressão da falha crítica do code review: a verificação de assinatura era
 * `if (webhookSecret && signature)`, então OMITIR o header pulava a checagem
 * inteira. Como /api/webhooks/abacatepay é público e move dinheiro, qualquer
 * um podia POSTar billing.paid e marcar um pedido como pago sem pagar.
 *
 * Os testes usam um evento que NÃO é billing.paid: a verificação roda e o
 * handler retorna antes de tocar o banco, então isto exercita o código real
 * sem precisar de Postgres.
 */
const SECRET = 'segredo-de-teste'
const svc = new PaymentService()

const body = JSON.stringify({ event: 'billing.created', data: { billing: { id: 'ch_1' } } })
const sign = (raw: string, secret = SECRET) =>
  'sha256=' + createHmac('sha256', secret).update(raw).digest('hex')

const envAnterior = { ...process.env }
beforeEach(() => {
  process.env.ABACATEPAY_WEBHOOK_SECRET = SECRET
  delete process.env.NODE_ENV
})
afterAll(() => {
  process.env = envAnterior
})

describe('assinatura do webhook', () => {
  it('RECUSA quando o header de assinatura não vem (o bypass original)', async () => {
    await expect(svc.handleWebhook(body, undefined)).rejects.toThrow(/ausente/i)
  })

  it('recusa assinatura vazia', async () => {
    await expect(svc.handleWebhook(body, '')).rejects.toThrow(/ausente/i)
  })

  it('recusa assinatura de outro segredo', async () => {
    const forjada = sign(body, 'segredo-errado')
    await expect(svc.handleWebhook(body, forjada)).rejects.toThrow(/inválida/i)
  })

  it('recusa hex malformado sem estourar no timingSafeEqual', async () => {
    // Buffers de tamanhos diferentes fazem timingSafeEqual lançar TypeError;
    // o guard de tamanho tem que converter isso em recusa limpa.
    await expect(svc.handleWebhook(body, 'sha256=naoehex')).rejects.toThrow(/inválida/i)
    await expect(svc.handleWebhook(body, 'sha256=' + 'a'.repeat(63))).rejects.toThrow(/inválida/i)
  })

  it('recusa assinatura válida de OUTRO corpo (replay cruzado)', async () => {
    const outroCorpo = JSON.stringify({ event: 'billing.created', data: { billing: { id: 'ch_2' } } })
    await expect(svc.handleWebhook(body, sign(outroCorpo))).rejects.toThrow(/inválida/i)
  })

  it('aceita assinatura correta', async () => {
    await expect(svc.handleWebhook(body, sign(body))).resolves.toEqual({ received: true })
  })

  it('aceita o hex puro, sem o prefixo sha256=', async () => {
    const hexPuro = createHmac('sha256', SECRET).update(body).digest('hex')
    await expect(svc.handleWebhook(body, hexPuro)).resolves.toEqual({ received: true })
  })
})

describe('webhook sem segredo configurado', () => {
  beforeEach(() => {
    delete process.env.ABACATEPAY_WEBHOOK_SECRET
  })

  it('em produção RECUSA tudo — não existe webhook confiável sem segredo', async () => {
    process.env.NODE_ENV = 'production'
    await expect(svc.handleWebhook(body, sign(body))).rejects.toThrow(/não configurado/i)
    await expect(svc.handleWebhook(body, undefined)).rejects.toThrow(/não configurado/i)
  })

  it('em dev aceita, para o fluxo de demonstração local seguir', async () => {
    await expect(svc.handleWebhook(body, undefined)).resolves.toEqual({ received: true })
  })
})
