import { createHmac } from 'crypto'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'

const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v1'

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
        customer: { name: params.customer.name, email: params.customer.email },
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

      await prisma.$transaction([
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

      return { paymentUrl, pixCode, pixQrCode, expiresAt }
    }

    await prisma.transaction.create({
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
      }
    }

    return { received: true }
  }

  // Chamado internamente quando um order é marcado como COMPLETED
  async releasePayment(orderId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { orderId },
      select: { id: true, status: true },
    })
    if (!transaction || transaction.status !== 'HELD') return

    // TODO: chamar API Abacatepay para transferir valor líquido ao editor
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'RELEASED' },
    })
  }

  // Chamado internamente quando uma disputa é resolvida em favor do creator
  async refundPayment(orderId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { orderId },
      select: { id: true, status: true },
    })
    if (!transaction || transaction.status !== 'HELD') return

    // TODO: chamar API Abacatepay para estornar o valor ao creator
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'REFUNDED' },
    })
  }
}

export const paymentService = new PaymentService()
