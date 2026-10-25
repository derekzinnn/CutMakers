import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'
import { logEvent } from './audit.service'
import * as gateway from '../lib/abacatepay'

// O AbacatePay exige `customer.cellphone` e `customer.taxId` (CPF/CNPJ) no PIX.
// Como ainda não coletamos esses dados do usuário no cadastro, usamos fallbacks configuráveis
// via env. Em produção, substituir por dados reais coletados do usuário.
const ABACATEPAY_FALLBACK_CELLPHONE = process.env.ABACATEPAY_FALLBACK_CELLPHONE ?? '(11) 99999-9999'
const ABACATEPAY_FALLBACK_TAX_ID = process.env.ABACATEPAY_FALLBACK_TAX_ID ?? '529.982.247-25'

export interface PixChargeResult {
  externalPaymentId: string | null
  pixCode: string | null
  pixQrCode: string | null
  expiresAt: string | null
  devMode: boolean
}

/** Compara strings em tempo constante, sem vazar o tamanho (compara os digests). */
function safeEqual(a: string, b: string) {
  const da = createHash('sha256').update(a).digest()
  const db = createHash('sha256').update(b).digest()
  return timingSafeEqual(da, db)
}

export class PaymentService {
  private get webhookSecret() {
    return process.env.ABACATEPAY_WEBHOOK_SECRET
  }
  /** Chave publica do AbacatePay para o HMAC do corpo (opcional; reforca a integridade). */
  private get webhookPublicKey() {
    return process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY
  }

  /**
   * Cria uma cobrança PIX avulsa (pedidos) no AbacatePay v2.
   * Sem ABACATEPAY_API_KEY (dev) devolve um id sintético — o chamador decide como
   * simular a confirmação. Assinaturas NÃO passam por aqui: usam checkout hospedado.
   */
  async createPixCharge(params: {
    amount: number
    externalId: string
    productName: string
    customer: { name: string; email: string }
    metadata?: Record<string, string>
  }): Promise<PixChargeResult> {
    if (!gateway.gatewayEnabled()) {
      return {
        externalPaymentId: `dev_${params.externalId}`,
        pixCode: null,
        pixQrCode: null,
        expiresAt: null,
        devMode: true,
      }
    }

    const charge = await gateway.createPixCharge({
      amountCents: Math.round(params.amount * 100),
      externalId: params.externalId,
      description: params.productName,
      customer: {
        name: params.customer.name,
        email: params.customer.email,
        cellphone: ABACATEPAY_FALLBACK_CELLPHONE,
        taxId: ABACATEPAY_FALLBACK_TAX_ID,
      },
      metadata: params.metadata,
    })
    return {
      externalPaymentId: charge.id,
      pixCode: charge.brCode,
      pixQrCode: charge.brCodeBase64,
      expiresAt: charge.expiresAt,
      devMode: false,
    }
  }

  async initiatePayment(orderId: string, requesterId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        transaction: {
          select: { id: true, status: true, pixCode: true, pixQrCode: true, chargeExpiresAt: true },
        },
      },
    })

    if (!order) throw NotFound('Pedido não encontrado')
    if (order.creatorId !== requesterId) throw Forbidden('Apenas o creator pode iniciar pagamento')
    if (order.status !== 'AWAITING_PAYMENT' && order.status !== 'ACCEPTED') {
      throw BadRequest('Pedido precisa estar aguardando pagamento para iniciar cobrança')
    }

    // Cobrança já iniciada: se ainda está PENDING e o PIX não expirou, REABRE o mesmo
    // (o criador fechou o modal, trocou de aba) em vez de bloquear — o QR só existe na
    // nossa tela, então sem isto ele perderia o acesso ao PIX que acabou de gerar.
    // Já paga (HELD/RELEASED/...) continua barrada. Expirada: gera outra no mesmo registro.
    const existing = order.transaction
    if (existing && existing.status !== 'PENDING') {
      throw BadRequest('Pagamento já foi iniciado para este pedido')
    }
    if (existing?.pixCode && existing.chargeExpiresAt && existing.chargeExpiresAt > new Date()) {
      return {
        paymentUrl: null,
        pixCode: existing.pixCode,
        pixQrCode: existing.pixQrCode,
        expiresAt: existing.chargeExpiresAt.toISOString(),
      }
    }

    // Gate contratual: ambas as partes precisam ter aceitado os termos do pedido.
    // Lazy import evita ciclo de dependência entre payment e agreement services.
    const { agreementService } = await import('./agreement.service')
    const agreement = await agreementService.ensureAgreement(orderId)
    if (!agreement.bothAccepted) {
      throw BadRequest('Ambas as partes precisam aceitar os termos do contrato antes do pagamento')
    }

    const amount = Number(order.budget)
    const platformFee = Number(order.platformFee)
    // Subtração em Decimal: 199.99 - 20 em float dá 179.99000000000001, e este
    // valor vai para a coluna Decimal e para o DTO do financeiro
    const netAmount = new Prisma.Decimal(order.budget).minus(order.platformFee).toNumber()

    // Em dev (sem ABACATEPAY_API_KEY) devolve devMode: true e um id sintético.
    // Reaproveitar a MESMA externalId numa nova cobrança (PIX expirado) bateria na
    // idempotência do gateway; o sufixo da tentativa evita devolver a cobrança velha.
    const charge = await this.createPixCharge({
      amount,
      externalId: existing ? `${order.id}-${Date.now()}` : order.id,
      productName: order.title,
      customer: { name: order.creator.name, email: order.creator.email },
      metadata: { orderId: order.id },
    })

    const { externalPaymentId, pixCode, pixQrCode, expiresAt } = charge
    const paymentUrl = null // PIX transparente (v2): não há página hospedada, o QR é nosso

    if (charge.devMode) {
      // Dev mode: confirma na hora para o fluxo de demonstração seguir
      const [devTransaction] = await prisma.$transaction([
        prisma.transaction.create({
          data: {
            orderId: order.id,
            payerId: order.creatorId,
            payeeId: order.editorId,
            amount,
            platformFee,
            netAmount,
            status: 'HELD',
            externalPaymentId,
          },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'IN_PROGRESS' },
        }),
        prisma.notification.create({
          data: {
            userId: order.editorId,
            type: 'PAYMENT_CONFIRMED',
            title: 'Pagamento confirmado — pode iniciar o projeto!',
            body: `Pagamento recebido para "${order.title}". Você já pode iniciar o trabalho.`,
            relatedOrderId: order.id,
          },
        }),
      ])

      await logEvent({
        actorId: requesterId,
        action: 'PAYMENT_INITIATED',
        entityType: 'Transaction',
        entityId: devTransaction.id,
        metadata: { orderId: order.id, amount, externalPaymentId },
      })
      // Dev mode auto-confirma — evento de sistema
      await logEvent({
        actorId: null,
        action: 'PAYMENT_CONFIRMED',
        entityType: 'Transaction',
        entityId: devTransaction.id,
        metadata: { orderId: order.id, devMode: true },
      })

      return { paymentUrl, pixCode, pixQrCode, expiresAt }
    }

    const pixData = {
      externalPaymentId,
      pixCode,
      pixQrCode,
      chargeExpiresAt: expiresAt ? new Date(expiresAt) : null,
    }
    const transaction = existing
      ? await prisma.transaction.update({ where: { id: existing.id }, data: pixData })
      : await prisma.transaction.create({
          data: {
            orderId: order.id,
            payerId: order.creatorId,
            payeeId: order.editorId,
            amount,
            platformFee,
            netAmount,
            status: 'PENDING',
            ...pixData,
          },
        })

    await logEvent({
      actorId: requesterId,
      action: 'PAYMENT_INITIATED',
      entityType: 'Transaction',
      entityId: transaction.id,
      metadata: { orderId: order.id, amount, externalPaymentId },
    })

    return { paymentUrl, pixCode, pixQrCode, expiresAt }
  }

  /**
   * Autentica o webhook. Fail-closed por design — este endpoint é público e move
   * dinheiro, então na dúvida ele recusa:
   *   - produção sem segredo → recusa tudo; não existe webhook confiável sem segredo
   *   - dev sem segredo → aceita, para o fluxo de demonstração local continuar funcionando
   *   - com segredo → o `webhookSecret` da URL é OBRIGATÓRIO (prova de origem). Omitir
   *     o parâmetro não pula a checagem
   *   - com ABACATEPAY_WEBHOOK_PUBLIC_KEY → a assinatura HMAC-SHA256 (base64) do corpo
   *     bruto também é obrigatória (prova de integridade)
   *
   * O AbacatePay anexa o segredo que escolhemos ao registrar o webhook como
   * `?webhookSecret=`; o header `X-Webhook-Signature` só garante que o corpo não
   * foi alterado, por isso ele sozinho nunca basta.
   */
  private verifyWebhook(rawBody: string, auth: { querySecret?: string; signature?: string }) {
    const secret = this.webhookSecret

    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw Forbidden('Webhook não configurado: defina ABACATEPAY_WEBHOOK_SECRET')
      }
      return
    }

    if (!auth.querySecret) throw Forbidden('Segredo do webhook ausente')
    if (!safeEqual(auth.querySecret, secret)) throw Forbidden('Segredo do webhook inválido')

    const publicKey = this.webhookPublicKey
    if (!publicKey) return

    if (!auth.signature) throw Forbidden('Assinatura do webhook ausente')
    const expected = createHmac('sha256', publicKey).update(rawBody, 'utf8').digest('base64')
    if (!safeEqual(auth.signature, expected)) throw Forbidden('Assinatura do webhook inválida')
  }

  async handleWebhook(rawBody: string, auth: { querySecret?: string; signature?: string }) {
    this.verifyWebhook(rawBody, auth)

    let event: { id?: string; event?: string; data?: unknown }
    try {
      event = JSON.parse(rawBody)
    } catch {
      throw BadRequest('Payload do webhook inválido')
    }

    const name = event.event ?? ''
    // O formato de transparent.* e subscription.* não é documentado: procuramos os ids
    // em qualquer ponto do payload e deixamos o banco e a API dizerem o que é nosso
    const ids = gateway.collectGatewayIds(event.data)

    if (name === 'transparent.completed') return this.confirmPixByGatewayIds(ids)

    if (name.startsWith('subscription.') || name === 'checkout.completed') {
      // Lazy import evita ciclo de dependência entre payment e subscription services
      const { subscriptionService } = await import('./subscription.service')
      return subscriptionService.handleGatewayEvent({ name, eventId: event.id ?? null, ids })
    }

    return { received: true }
  }

  /** PIX de pedido pago: acha a transação pelo id do gateway e confirma. */
  private async confirmPixByGatewayIds(ids: string[]) {
    if (ids.length === 0) return { received: true }

    const transaction = await prisma.transaction.findFirst({
      where: { externalPaymentId: { in: ids } },
      include: { order: { select: { id: true, status: true, title: true } } },
    })
    if (!transaction?.externalPaymentId) return { received: true }

    // Não confiamos no corpo do evento para mover dinheiro: perguntamos ao gateway.
    // Sem chave (dev/teste) não há a quem perguntar, então o evento autenticado vale.
    if (gateway.gatewayEnabled()) {
      const charge = await gateway.checkPixCharge(transaction.externalPaymentId)
      if (charge.status !== 'PAID') return { received: true, ignored: true }
    }

    const claimed = await this.claimPaidTransaction(transaction)
    // Reenvio de um pagamento já processado: 200 para o gateway parar de retentar
    return claimed ? { received: true } : { received: true, duplicate: true }
  }

  /**
   * Rede de segurança para webhook perdido: confere no gateway as cobranças PIX ainda
   * PENDING (e não expiradas há muito) e confirma as que já foram pagas. Roda no cron.
   */
  async reconcilePendingPayments() {
    if (!gateway.gatewayEnabled()) return { checked: 0, confirmed: 0 }

    const pending = await prisma.transaction.findMany({
      where: { status: 'PENDING', externalPaymentId: { not: null } },
      include: { order: { select: { id: true, status: true, title: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    let confirmed = 0
    for (const transaction of pending) {
      try {
        const charge = await gateway.checkPixCharge(transaction.externalPaymentId!)
        if (charge.status === 'PAID' && (await this.claimPaidTransaction(transaction))) confirmed++
      } catch {
        // uma cobrança com erro não impede as demais; a próxima rodada tenta de novo
      }
    }
    return { checked: pending.length, confirmed }
  }

  /**
   * PENDING → HELD, uma única vez.
   *
   * Idempotência: gateways reenviam webhooks (retry automático, reenvio manual pelo
   * painel, replay). Sem guard, um reenvio depois da aprovação regravaria RELEASED →
   * HELD e corromperia o resumo financeiro. O updateMany com `status: 'PENDING'` no
   * where é o lock otimista: só a primeira entrega encontra a linha nesse estado e a
   * reivindica. Tudo numa transação — ou o escrow e o pedido avançam juntos, ou nada.
   */
  private async claimPaidTransaction(transaction: {
    id: string
    orderId: string
    payeeId: string
    externalPaymentId: string | null
    order: { status: string; title: string }
  }) {
    const claimed = await prisma.$transaction(async (tx) => {
      const claim = await tx.transaction.updateMany({
        where: { id: transaction.id, status: 'PENDING' },
        data: { status: 'HELD' },
      })
      if (claim.count === 0) return false

      await tx.notification.create({
        data: {
          userId: transaction.payeeId,
          type: 'PAYMENT_CONFIRMED',
          title: 'Pagamento confirmado — pode iniciar o projeto!',
          body: `Pagamento recebido para "${transaction.order.title}". Você já pode iniciar o trabalho.`,
          relatedOrderId: transaction.orderId,
        },
      })

      // Fluxo novo (negociação/solicitação): o pagamento libera o início do trabalho.
      // Fluxo legado (ACCEPTED) já tinha o pedido em andamento.
      if (transaction.order.status === 'AWAITING_PAYMENT') {
        await tx.order.update({
          where: { id: transaction.orderId },
          data: { status: 'IN_PROGRESS' },
        })
      }
      return true
    })

    if (claimed) {
      // Evento de sistema — confirmado pelo gateway
      await logEvent({
        actorId: null,
        action: 'PAYMENT_CONFIRMED',
        entityType: 'Transaction',
        entityId: transaction.id,
        metadata: { orderId: transaction.orderId, externalPaymentId: transaction.externalPaymentId },
      })
    }
    return claimed
  }

  /**
   * Histórico de pagamentos do creator logado (transações onde ele é o pagador),
   * com resumo do pedido e totais para os cards da aba Pagamentos.
   */
  async getMyPayments(userId: string, page = 1) {
    const PER_PAGE = 20
    const currentPage = Math.max(page, 1)
    const where = { payerId: userId }

    const [transactions, total, held, released, allPaid] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip: (currentPage - 1) * PER_PAGE,
        take: PER_PAGE,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          status: true,
          externalPaymentId: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              title: true,
              status: true,
              editor: { select: { name: true } },
              category: { select: { name: true } },
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({ where: { ...where, status: 'HELD' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { ...where, status: 'RELEASED' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({
        where: { ...where, status: { in: ['HELD', 'RELEASED'] } },
        _sum: { amount: true },
      }),
    ])

    return {
      payments: transactions.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        status: t.status,
        externalPaymentId: t.externalPaymentId,
        createdAt: t.createdAt,
        order: {
          id: t.order.id,
          title: t.order.title,
          status: t.order.status,
          editorName: t.order.editor.name,
          categoryName: t.order.category.name,
        },
      })),
      summary: {
        totalPaid: Number(allPaid._sum.amount ?? 0),
        totalHeld: Number(held._sum.amount ?? 0),
        totalCompleted: Number(released._sum.amount ?? 0),
      },
      total,
      page: currentPage,
      limit: PER_PAGE,
      totalPages: Math.ceil(total / PER_PAGE),
    }
  }

  // Chamado internamente quando um order é marcado como COMPLETED.
  // actorId: quem disparou (creator aprovando, admin) — null em fluxos automáticos.
  async releasePayment(orderId: string, actorId: string | null = null) {
    const transaction = await prisma.transaction.findUnique({
      where: { orderId },
      select: { id: true, status: true, amount: true, netAmount: true },
    })
    if (!transaction || transaction.status !== 'HELD') return

    // TODO: chamar API Abacatepay para transferir valor líquido ao editor
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'RELEASED' },
    })

    await logEvent({
      actorId,
      action: 'PAYMENT_RELEASED',
      entityType: 'Transaction',
      entityId: transaction.id,
      metadata: { orderId, amount: Number(transaction.amount), netAmount: Number(transaction.netAmount) },
    })
  }

  // Chamado internamente quando uma disputa é resolvida em favor do creator
  async refundPayment(orderId: string, actorId: string | null = null) {
    const transaction = await prisma.transaction.findUnique({
      where: { orderId },
      select: { id: true, status: true, amount: true },
    })
    if (!transaction || transaction.status !== 'HELD') return

    // TODO: chamar API Abacatepay para estornar o valor ao creator
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'REFUNDED' },
    })

    await logEvent({
      actorId,
      action: 'PAYMENT_REFUNDED',
      entityType: 'Transaction',
      entityId: transaction.id,
      metadata: { orderId, amount: Number(transaction.amount) },
    })
  }
}

export const paymentService = new PaymentService()
