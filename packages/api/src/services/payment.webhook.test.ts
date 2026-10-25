import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { createHmac } from 'crypto'
import { PaymentService } from './payment.service'

/**
 * Regressão da falha crítica do code review: a verificação era
 * `if (webhookSecret && signature)`, então OMITIR o header pulava a checagem inteira.
 * Como /api/webhooks/abacatepay é público e move dinheiro, qualquer um podia POSTar
 * um evento de pagamento e marcar um pedido como pago sem pagar.
 *
 * AbacatePay v2: a prova de ORIGEM é o `webhookSecret` que o gateway anexa à URL; o
 * header X-Webhook-Signature (HMAC-SHA256 em base64 do corpo bruto) só prova INTEGRIDADE
 * e é exigido quando ABACATEPAY_WEBHOOK_PUBLIC_KEY está configurada.
 *
 * Os testes usam um evento sem efeito: a autenticação roda e o handler retorna antes
 * de tocar o banco, então isto exercita o código real sem precisar de Postgres.
 */
const SECRET = 'segredo-de-teste'
const PUBLIC_KEY = 'chave-publica-de-teste'
const svc = new PaymentService()

const body = JSON.stringify({ id: 'log_1', event: 'payout.completed', data: {} })
const hmac = (raw: string, key = PUBLIC_KEY) => createHmac('sha256', key).update(raw, 'utf8').digest('base64')

const envAnterior = { ...process.env }
beforeEach(() => {
  process.env.ABACATEPAY_WEBHOOK_SECRET = SECRET
  delete process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY
  delete process.env.NODE_ENV
})
afterAll(() => {
  process.env = envAnterior
})

describe('segredo do webhook (prova de origem)', () => {
  it('RECUSA quando o segredo não vem na URL (o bypass original)', async () => {
    await expect(svc.handleWebhook(body, {})).rejects.toThrow(/ausente/i)
  })

  it('recusa segredo vazio', async () => {
    await expect(svc.handleWebhook(body, { querySecret: '' })).rejects.toThrow(/ausente/i)
  })

  it('recusa segredo errado', async () => {
    await expect(svc.handleWebhook(body, { querySecret: 'segredo-errado' })).rejects.toThrow(/inválido/i)
  })

  it('recusa segredo que é só prefixo do verdadeiro', async () => {
    await expect(svc.handleWebhook(body, { querySecret: SECRET.slice(0, -1) })).rejects.toThrow(/inválido/i)
  })

  it('aceita o segredo correto', async () => {
    await expect(svc.handleWebhook(body, { querySecret: SECRET })).resolves.toEqual({ received: true })
  })

  it('a assinatura HMAC sozinha NÃO substitui o segredo da URL', async () => {
    process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY = PUBLIC_KEY
    await expect(svc.handleWebhook(body, { signature: hmac(body) })).rejects.toThrow(/ausente/i)
  })
})

describe('assinatura HMAC (integridade) com ABACATEPAY_WEBHOOK_PUBLIC_KEY', () => {
  beforeEach(() => {
    process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY = PUBLIC_KEY
  })

  it('exige o header quando a chave pública está configurada', async () => {
    await expect(svc.handleWebhook(body, { querySecret: SECRET })).rejects.toThrow(/ausente/i)
  })

  it('aceita a assinatura correta (base64 do corpo bruto)', async () => {
    await expect(svc.handleWebhook(body, { querySecret: SECRET, signature: hmac(body) })).resolves.toEqual({
      received: true,
    })
  })

  it('recusa assinatura feita com outra chave', async () => {
    const forjada = hmac(body, 'outra-chave')
    await expect(svc.handleWebhook(body, { querySecret: SECRET, signature: forjada })).rejects.toThrow(/inválida/i)
  })

  it('recusa assinatura válida de OUTRO corpo (replay cruzado)', async () => {
    const outro = JSON.stringify({ id: 'log_2', event: 'payout.completed', data: {} })
    await expect(svc.handleWebhook(body, { querySecret: SECRET, signature: hmac(outro) })).rejects.toThrow(/inválida/i)
  })

  it('recusa assinatura em hex (o formato era base64) sem estourar', async () => {
    const hex = createHmac('sha256', PUBLIC_KEY).update(body, 'utf8').digest('hex')
    await expect(svc.handleWebhook(body, { querySecret: SECRET, signature: hex })).rejects.toThrow(/inválida/i)
  })
})

describe('webhook sem segredo configurado', () => {
  beforeEach(() => {
    delete process.env.ABACATEPAY_WEBHOOK_SECRET
  })

  it('em produção RECUSA tudo — não existe webhook confiável sem segredo', async () => {
    process.env.NODE_ENV = 'production'
    await expect(svc.handleWebhook(body, { querySecret: SECRET })).rejects.toThrow(/não configurado/i)
    await expect(svc.handleWebhook(body, {})).rejects.toThrow(/não configurado/i)
  })

  it('em dev aceita, para o fluxo de demonstração local seguir', async () => {
    await expect(svc.handleWebhook(body, {})).resolves.toEqual({ received: true })
  })
})

describe('payload', () => {
  it('JSON inválido autenticado é 400, não 500', async () => {
    await expect(svc.handleWebhook('{nao-e-json', { querySecret: SECRET })).rejects.toMatchObject({ status: 400 })
  })
})
