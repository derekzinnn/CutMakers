import { BadRequest } from './errors'

/**
 * Cliente da API v2 do AbacatePay.
 *
 * A v1 sai do ar; a v2 usa outro modelo: PIX avulso por `transparents` (valor livre,
 * QR gerado por nos) e assinatura por checkout hospedado de um produto com ciclo.
 * Toda a conversa HTTP fica aqui para payment.service e subscription.service nao
 * duplicarem fetch, parsing e tratamento de erro.
 */
const BASE_URL = 'https://api.abacatepay.com/v2'

/** Sem chave o sistema roda em modo demonstracao (cobranca simulada, sem gateway). */
export const gatewayEnabled = () => Boolean(process.env.ABACATEPAY_API_KEY)

interface Envelope<T> {
  success: boolean
  data: T | null
  error: string | null
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!res.ok || !json?.success || !json.data) {
    // `error` do gateway e texto curto ("Insufficient permissions"); nao carrega segredo
    throw BadRequest(`Erro no gateway de pagamento: ${json?.error ?? `HTTP ${res.status}`}`)
  }
  return json.data
}

// ─── PIX avulso (pedidos) ────────────────────────────────────────────────────

export interface PixCharge {
  id: string
  status: string
  /** Codigo "copia e cola" */
  brCode: string | null
  /** QR como data URI PNG, pronto para <img src> */
  brCodeBase64: string | null
  expiresAt: string | null
  devMode: boolean
}

export function createPixCharge(params: {
  amountCents: number
  externalId: string
  description: string
  customer: { name: string; email: string; taxId: string; cellphone: string }
  metadata?: Record<string, string>
}) {
  return call<PixCharge>('POST', '/transparents/create', {
    method: 'PIX',
    data: {
      amount: params.amountCents,
      description: params.description.slice(0, 500),
      externalId: params.externalId,
      customer: params.customer,
      metadata: params.metadata,
    },
  })
}

export function checkPixCharge(id: string) {
  return call<PixCharge>('GET', `/transparents/check?id=${encodeURIComponent(id)}`)
}

// ─── Assinatura (Premium) ────────────────────────────────────────────────────

export interface SubscriptionCheckout {
  id: string
  url: string
  status: string
  externalId: string | null
}

export function createSubscriptionCheckout(params: {
  productId: string
  externalId: string
  returnUrl: string
  completionUrl: string
}) {
  return call<SubscriptionCheckout>('POST', '/subscriptions/create', {
    items: [{ id: params.productId, quantity: 1 }],
    externalId: params.externalId,
    returnUrl: params.returnUrl,
    completionUrl: params.completionUrl,
    // Assinatura recorrente e por cartao. PIX Automatico existe, mas a documentacao nao
    // descreve como a renovacao acontece nele — nao dependemos disso.
    methods: ['CARD'],
  })
}

export function getSubscriptionCheckout(id: string) {
  return call<SubscriptionCheckout>('GET', `/subscriptions/checkouts/get?id=${encodeURIComponent(id)}`)
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

const GATEWAY_ID = /^(pix_char_|bill_|subs_)[A-Za-z0-9]+$/

/**
 * Ids do gateway encontrados em QUALQUER ponto do payload.
 *
 * O formato dos eventos transparent.* e subscription.* nao esta documentado (so o de
 * checkout: event.data.checkout.id). Em vez de apostar em um caminho de campo, varremos
 * o JSON atras de strings no formato dos ids e deixamos o banco decidir qual delas e
 * nossa. O id nunca e confiado sozinho: quem confirma o pagamento e a consulta a API.
 */
export function collectGatewayIds(payload: unknown): string[] {
  const found = new Set<string>()
  const walk = (node: unknown, depth: number) => {
    if (depth > 6 || found.size >= 50) return
    if (typeof node === 'string') {
      if (GATEWAY_ID.test(node)) found.add(node)
    } else if (Array.isArray(node)) {
      node.forEach((n) => walk(n, depth + 1))
    } else if (node && typeof node === 'object') {
      Object.values(node).forEach((n) => walk(n, depth + 1))
    }
  }
  walk(payload, 0)
  return [...found]
}
