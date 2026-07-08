import { createHmac } from 'crypto'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'
import { logEvent } from './audit.service'

const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v1'

// A Abacatepay exige `customer.cellphone` e `customer.taxId` (CPF/CNPJ) ao criar cobranças.
// Como ainda não coletamos esses dados do usuário no cadastro, usamos fallbacks configuráveis
// via env. Em produção, substituir por dados reais coletados do usuário.
const ABACATEPAY_FALLBACK_CELLPHONE = process.env.ABACATEPAY_FALLBACK_CELLPHONE ?? '(11) 99999-9999'
const ABACATEPAY_FALLBACK_TAX_ID = process.env.ABACATEPAY_FALLBACK_TAX_ID ?? '529.982.247-25'

export class PaymentService {
  private get apiKey() {
    return process.env.ABACATEPAY_API_KEY
  }
  private get webhookSecret() {
    return process.env.ABACATEPAY_WEBHOOK_SECRET
  }
  private get frontendUrl() {
    return process.env.FRONTEND_URL ?? 'http://localhost:5173'
  }

  /**
   * Cria uma cobrança PIX genérica no Abacatepay (reutilizada por orders e assinaturas).
   * Em dev (sem ABACATEPAY_API_KEY) retorna um id sintético e sem URL — o chamador
   * decide como simular a confirmação.
   */
  async createPixCharge(params: {
    amount: number
    externalId: string
    productName: string
    customer: { name: string; email: string }
    returnPath: string
  }): Promise<{
    externalPaymentId: string | null
    paymentUrl: string | null
    pixCode: string | null
    pixQrCode: string | null
    expiresAt: string | null
    devMode: boolean
  }> {
    if (!this.apiKey) {
      return {
        externalPaymentId: `dev_${params.externalId}`,
        paymentUrl: null,
        pixCode: null,
        pixQrCode: null,
        expiresAt: null,
        devMode: true,
      }
    }

    const res = await fetch(`${ABACATEPAY_API_URL}/billing/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        frequency: 'ONE_TIME',
        methods: ['PIX'],
        products: [
          {
            externalId: params.externalId,
            name: params.productName.slice(0, 100),
            quantity: 1,
            price: Math.round(params.amount * 100),
          },
        ],
        customer: {
          name: params.customer.name,
          email: params.customer.email,
          cellphone: ABACATEPAY_FALLBACK_CELLPHONE,
          taxId: ABACATEPAY_FALLBACK_TAX_ID,
        },
        returnUrl: `${this.frontendUrl}${params.returnPath}`,
        completionUrl: `${this.frontendUrl}${params.returnPath}`,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw BadRequest(`Erro ao criar cobrança: ${text}`)
    }

    const json = (await res.json()) as {
      data?: { id?: string; url?: string; pixCode?: string; pixQrCode?: string; expiresAt?: string }
    }
    return {
      externalPaymentId: json.data?.id ?? null,
      paymentUrl: json.data?.url ?? null,
      pixCode: json.data?.pixCode ?? null,
      pixQrCode: json.data?.pixQrCode ?? null,
      expiresAt: json.data?.expiresAt ?? null,
      devMode: false,
    }
  }

  async initiatePayment(orderId: string, requesterId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        transaction: { select: { id: true } },
      },
    })

    if (!order) throw NotFound('Pedido não encontrado')
    if (order.creatorId !== requesterId) throw Forbidden('Apenas o creator pode iniciar pagamento')
    if (order.status !== 'AWAITING_PAYMENT' && order.status !== 'ACCEPTED') {
      throw BadRequest('Pedido precisa estar aguardando pagamento para iniciar cobrança')
    }
    if (order.transaction) throw BadRequest('Pagamento já foi iniciado para este pedido')

    // Gate contratual: ambas as partes precisam ter aceitado os termos do pedido.
    // Lazy import evita ciclo de dependência entre payment e agreement services.
    const { agreementService } = await import('./agreement.service')
    const agreement = await agreementService.ensureAgreement(orderId)
    if (!agreement.bothAccepted) {
      throw BadRequest('Ambas as partes precisam aceitar os termos do contrato antes do pagamento')
    }

    const amount = Number(order.budget)
    const platformFee = Number(order.platformFee)
    const netAmount = amount - platformFee
    const amountCents = Math.round(amount * 100)

    let externalPaymentId: string | null = null
    let paymentUrl: string | null = null
    let pixCode: string | null = null
    let pixQrCode: string | null = null
    let expiresAt: string | null = null

    if (this.apiKey) {
      const res = await fetch(`${ABACATEPAY_API_URL}/billing/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          frequency: 'ONE_TIME',
          methods: ['PIX'],
          products: [
            {
              externalId: order.id,
              name: order.title.slice(0, 100),
              quantity: 1,
              price: amountCents,
            },
          ],
          customer: {
            name: order.creator.name,
            email: order.creator.email,
            cellphone: ABACATEPAY_FALLBACK_CELLPHONE,
            taxId: ABACATEPAY_FALLBACK_TAX_ID,
          },
          returnUrl: `${this.frontendUrl}/orders/${order.id}`,
          completionUrl: `${this.frontendUrl}/orders/${order.id}`,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw BadRequest(`Erro ao criar cobrança: ${text}`)
      }

      const json = (await res.json()) as {
        data?: { id?: string; url?: string; pixCode?: string; pixQrCode?: string; expiresAt?: string }
      }
      externalPaymentId = json.data?.id ?? null
      paymentUrl = json.data?.url ?? null
      pixCode = json.data?.pixCode ?? null
      pixQrCode = json.data?.pixQrCode ?? null
      expiresAt = json.data?.expiresAt ?? null
    } else {
      // Dev mode: auto-confirm payment so the demo flow progresses
      externalPaymentId = `dev_${order.id}`
      paymentUrl = null
      pixCode = null
      pixQrCode = null
      expiresAt = null

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

    const transaction = await prisma.transaction.create({
      data: {
        orderId: order.id,
        payerId: order.creatorId,
        payeeId: order.editorId,
        amount,
        platformFee,
        netAmount,
        status: 'PENDING',
        externalPaymentId,
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

  async handleWebhook(rawBody: string, signature: string | undefined) {
    if (this.webhookSecret && signature) {
      const expected = `sha256=${createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex')}`
      if (signature !== expected) throw Forbidden('Assinatura do webhook inválida')
    }

    const event = JSON.parse(rawBody) as {
      event: string
      data?: { billing?: { id?: string } }
    }

    if (event.event === 'billing.paid' && event.data?.billing?.id) {
      const externalId = event.data.billing.id
      const transaction = await prisma.transaction.findFirst({
        where: { externalPaymentId: externalId },
        include: { order: { select: { id: true, status: true, title: true } } },
      })

      // Não é pagamento de pedido → pode ser uma assinatura premium
      if (!transaction) {
        const subscription = await prisma.subscription.findFirst({
          where: { externalSubscriptionId: externalId },
          select: { id: true, status: true },
        })
        if (subscription && subscription.status === 'PENDING') {
          // Lazy import evita ciclo de dependência entre payment e subscription services
          const { subscriptionService } = await import('./subscription.service')
          await subscriptionService.confirmSubscriptionPayment(subscription.id)
        }
        return { received: true }
      }

      if (transaction) {
        const isNewFlow = transaction.order.status === 'AWAITING_PAYMENT'

        const baseOps = [
          prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'HELD' },
          }),
          prisma.notification.create({
            data: {
              userId: transaction.payeeId,
              type: 'PAYMENT_CONFIRMED',
              title: 'Pagamento confirmado — pode iniciar o projeto!',
              body: `Pagamento recebido para "${transaction.order.title}". Você já pode iniciar o trabalho.`,
              relatedOrderId: transaction.orderId,
            },
          }),
        ] as const

        if (isNewFlow) {
          await prisma.$transaction([
            ...baseOps,
            prisma.order.update({
              where: { id: transaction.orderId },
              data: { status: 'IN_PROGRESS' },
            }),
          ])
        } else {
          await prisma.$transaction([...baseOps])
        }

        // Evento de sistema — confirmado pelo webhook do Abacatepay
        await logEvent({
          actorId: null,
          action: 'PAYMENT_CONFIRMED',
          entityType: 'Transaction',
          entityId: transaction.id,
          metadata: { orderId: transaction.orderId, externalPaymentId: externalId },
        })
      }
    }

    return { received: true }
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
          platformFee: true,
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
        platformFee: Number(t.platformFee),
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
