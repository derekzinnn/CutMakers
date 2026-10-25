import { Subscription } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { BadRequest, NotFound } from '../lib/errors'
import * as gateway from '../lib/abacatepay'
import { logEvent } from './audit.service'
import { portfolioLimitFor, PREMIUM_PORTFOLIO_LIMIT } from '../lib/plans'

// ─── Constantes ────────────────────────────────────────────────────────────────

export const PREMIUM_MONTHLY_PRICE = 39.9
const PERIOD_DAYS = 30
const RENEW_WINDOW_DAYS = 5 // renovação permitida a partir dos últimos 5 dias
/** Tempo que uma cobrança PENDING segue valendo antes de ser considerada abandonada. */
const PENDING_CHARGE_TTL_MIN = 30
const DAY_MS = 24 * 60 * 60 * 1000

// ─── DTO ───────────────────────────────────────────────────────────────────────

export function subscriptionToDTO(s: Subscription) {
  return {
    id: s.id,
    status: s.status,
    amount: Number(s.amount),
    startedAt: s.startedAt,
    expiresAt: s.expiresAt,
    /** Renova sozinha todo ciclo no cartão — a UI não oferece "Renovar" nesses casos */
    recurring: s.recurring,
  }
}

export interface MySubscriptionDTO {
  isPremium: boolean
  premiumExpiresAt: Date | null
  price: number
  subscription: ReturnType<typeof subscriptionToDTO> | null
  /** Teto de publicacoes do plano atual */
  portfolioLimit: number
  /** Quantas o editor ja publicou — a UI usa para avisar ANTES de bloquear */
  portfolioUsed: number
  /** Teto do Premium, para a UI mostrar o ganho de assinar */
  portfolioLimitPremium: number
  /** Cobranca PIX em aberto (PENDING recente), para a UI oferecer "reabrir" */
  pendingCharge: { pixCode: string | null; paymentUrl: string | null; expiresAt: Date | null } | null
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class SubscriptionService {
  private async getOrCreateProfile(userId: string) {
    let profile = await prisma.editorProfile.findUnique({
      where: { userId },
      include: { user: { select: { name: true, email: true } } },
    })
    if (!profile) {
      await prisma.editorProfile.create({ data: { userId } })
      profile = await prisma.editorProfile.findUnique({
        where: { userId },
        include: { user: { select: { name: true, email: true } } },
      })
    }
    if (!profile) throw NotFound('Perfil de editor não encontrado')
    return profile
  }

  async createSubscription(userId: string) {
    const profile = await this.getOrCreateProfile(userId)

    // Bloqueia nova assinatura se já houver uma ativa fora da janela de renovação
    const active = await prisma.subscription.findFirst({
      where: { editorProfileId: profile.id, status: 'ACTIVE' },
    })
    if (active?.recurring) {
      // Uma 2a assinatura recorrente cobraria o editor em DOBRO todo mês
      throw BadRequest('Sua assinatura Premium renova automaticamente todo mês no cartão.')
    }
    if (active) {
      const daysLeft = active.expiresAt ? (active.expiresAt.getTime() - Date.now()) / DAY_MS : Infinity
      if (daysLeft > RENEW_WINDOW_DAYS) {
        throw BadRequest(
          `Você já possui uma assinatura premium ativa (válida por mais ${Math.ceil(daysLeft)} dias)`,
        )
      }
    }

    // Cobranças PENDING abandonadas viram CANCELLED; uma recente bloqueia a criação
    // de outra. Sem isto, cada POST criava uma linha nova E uma cobrança nova no
    // gateway — chamar o endpoint em loop gerava cobranças ilimitadas, e cada
    // emissão tem custo real.
    const pendingCutoff = new Date(Date.now() - PENDING_CHARGE_TTL_MIN * 60 * 1000)
    await prisma.subscription.updateMany({
      where: {
        editorProfileId: profile.id,
        status: 'PENDING',
        startedAt: { lt: pendingCutoff },
      },
      data: { status: 'CANCELLED' },
    })

    const openPending = await prisma.subscription.findFirst({
      where: { editorProfileId: profile.id, status: 'PENDING' },
      orderBy: { startedAt: 'desc' },
    })
    if (openPending) {
      // Reabre a cobranca existente em vez de bloquear: o editor ve o MESMO PIX
      // de novo. Nao gera cobranca nova no gateway (que tem custo por emissao).
      return {
        paymentUrl: openPending.paymentUrl,
        pixCode: openPending.pixCode,
        pixQrCode: openPending.pixQrCode,
        expiresAt: openPending.chargeExpiresAt ? openPending.chargeExpiresAt.toISOString() : null,
        devConfirmed: false,
        reopened: true,
      }
    }

    // Registro inicial em PENDING — só vira ACTIVE após confirmação do pagamento
    const subscription = await prisma.subscription.create({
      data: {
        editorProfileId: profile.id,
        status: 'PENDING',
        amount: PREMIUM_MONTHLY_PRICE,
      },
    })

    // Sem gateway (dev) confirmamos na hora para o fluxo de demonstração seguir
    if (!gateway.gatewayEnabled()) {
      await this.confirmSubscriptionPayment(subscription.id)
      return {
        paymentUrl: null,
        pixCode: null,
        pixQrCode: null,
        expiresAt: null,
        devConfirmed: true,
        reopened: false,
      }
    }

    // Se algo falhar daqui em diante, a linha PENDING sem dados de cobrança seria
    // "reaberta" vazia pelo próximo clique. Cancelamos para o editor poder tentar de novo.
    const abandon = () =>
      prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'CANCELLED' } })

    const productId = process.env.ABACATEPAY_PREMIUM_PRODUCT_ID
    if (!productId) {
      await abandon()
      throw BadRequest('Assinatura Premium indisponível no momento. Tente mais tarde.')
    }

    const backUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/dashboard/editor?section=premium`
    let checkout: gateway.SubscriptionCheckout
    try {
      // Recorrência por cartão, em checkout hospedado do produto com ciclo mensal.
      // externalId = nosso id, para o evento do webhook poder ser reconciliado.
      checkout = await gateway.createSubscriptionCheckout({
        productId,
        externalId: subscription.id,
        returnUrl: backUrl,
        completionUrl: backUrl,
      })
    } catch (err) {
      await abandon()
      throw err
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { externalSubscriptionId: checkout.id, paymentUrl: checkout.url, recurring: true },
    })

    return {
      paymentUrl: checkout.url,
      pixCode: null,
      pixQrCode: null,
      expiresAt: null,
      devConfirmed: false,
      reopened: false,
    }
  }

  async getMySubscription(userId: string): Promise<MySubscriptionDTO> {
    const profile = await prisma.editorProfile.findUnique({ where: { userId } })
    if (!profile) {
      return {
        isPremium: false,
        premiumExpiresAt: null,
        price: PREMIUM_MONTHLY_PRICE,
        subscription: null,
        portfolioLimit: portfolioLimitFor(false),
        portfolioUsed: 0,
        portfolioLimitPremium: PREMIUM_PORTFOLIO_LIMIT,
        pendingCharge: null,
      }
    }

    const [subscription, portfolioUsed] = await Promise.all([
      prisma.subscription.findFirst({
        where: { editorProfileId: profile.id },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.portfolioItem.count({ where: { editorProfileId: profile.id } }),
    ])

    // O editor volta do checkout hospedado ANTES do webhook chegar, e veria "pendente".
    // Perguntamos ao gateway agora; se já foi pago, ativa e relê o estado.
    if (subscription?.status === 'PENDING' && (await this.reconcileOne(subscription))) {
      return this.getMySubscription(userId)
    }

    // Cobranca em aberto so conta se for PENDING recente (dentro do TTL) e tiver PIX
    const pendingCharge =
      subscription &&
      subscription.status === 'PENDING' &&
      (subscription.pixCode || subscription.paymentUrl) &&
      Date.now() - subscription.startedAt.getTime() < PENDING_CHARGE_TTL_MIN * 60 * 1000
        ? {
            pixCode: subscription.pixCode,
            paymentUrl: subscription.paymentUrl,
            expiresAt: subscription.chargeExpiresAt,
          }
        : null

    return {
      isPremium: profile.isPremium,
      premiumExpiresAt: profile.premiumExpiresAt,
      price: PREMIUM_MONTHLY_PRICE,
      subscription: subscription ? subscriptionToDTO(subscription) : null,
      portfolioLimit: portfolioLimitFor(profile.isPremium),
      portfolioUsed,
      portfolioLimitPremium: PREMIUM_PORTFOLIO_LIMIT,
      pendingCharge,
    }
  }

  // Chamado pelo webhook do Abacatepay quando o pagamento é confirmado
  async confirmSubscriptionPayment(subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } })
    if (!subscription) throw NotFound('Assinatura não encontrada')
    if (subscription.status === 'ACTIVE') return subscriptionToDTO(subscription)

    const profile = await prisma.editorProfile.findUnique({ where: { id: subscription.editorProfileId } })

    // Renovação: estende a partir do vencimento atual se ainda estiver no futuro
    const currentExpiry = profile?.premiumExpiresAt
    const base = currentExpiry && currentExpiry.getTime() > Date.now() ? currentExpiry.getTime() : Date.now()
    const expiresAt = new Date(base + PERIOD_DAYS * DAY_MS)

    const [, updated] = await prisma.$transaction([
      // Encerra qualquer outra assinatura ativa do mesmo perfil (renovação)
      prisma.subscription.updateMany({
        where: { editorProfileId: subscription.editorProfileId, status: 'ACTIVE', id: { not: subscription.id } },
        data: { status: 'EXPIRED' },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'ACTIVE', expiresAt },
      }),
      prisma.editorProfile.update({
        where: { id: subscription.editorProfileId },
        data: { isPremium: true, premiumExpiresAt: expiresAt },
      }),
    ])

    // Evento de sistema — confirmação vem do webhook (ou auto-confirm em dev)
    await logEvent({
      actorId: null,
      action: 'SUBSCRIPTION_ACTIVATED',
      entityType: 'Subscription',
      entityId: subscription.id,
      metadata: { amount: Number(subscription.amount), expiresAt: expiresAt.toISOString() },
    })

    return subscriptionToDTO(updated)
  }

  /**
   * Pergunta ao gateway se o checkout de uma assinatura pendente já foi pago e, se
   * sim, ativa. Devolve true quando ativou. Não depende do formato do webhook.
   */
  private async reconcileOne(sub: Subscription): Promise<boolean> {
    if (!gateway.gatewayEnabled() || !sub.externalSubscriptionId) return false
    try {
      const checkout = await gateway.getSubscriptionCheckout(sub.externalSubscriptionId)
      if (checkout.status !== 'PAID') return false
      await this.confirmSubscriptionPayment(sub.id)
      return true
    } catch {
      return false // gateway fora do ar não pode derrubar a tela; a próxima leitura tenta de novo
    }
  }

  /** Rede de segurança para webhook perdido — roda no cron. */
  async reconcilePendingSubscriptions() {
    if (!gateway.gatewayEnabled()) return { checked: 0, confirmed: 0 }
    // Janela de 24h: um checkout hospedado pode ser pago bem depois dos 30min em que a
    // linha é considerada abandonada (CANCELLED), então ela entra na busca também.
    const since = new Date(Date.now() - DAY_MS)
    const candidates = await prisma.subscription.findMany({
      where: {
        status: { in: ['PENDING', 'CANCELLED'] },
        externalSubscriptionId: { not: null },
        startedAt: { gt: since },
      },
      take: 100,
    })
    let confirmed = 0
    for (const sub of candidates) {
      if (await this.reconcileOne(sub)) confirmed++
    }
    return { checked: candidates.length, confirmed }
  }

  /**
   * Eventos de assinatura do webhook. O formato do payload não é documentado, então
   * `ids` são os ids do gateway achados no corpo (ver collectGatewayIds); aqui só
   * decidimos QUAL assinatura nossa é a do evento e o que fazer com ela.
   */
  async handleGatewayEvent(ev: { name: string; eventId: string | null; ids: string[] }) {
    if (ev.ids.length === 0) return { received: true }

    const sub = await prisma.subscription.findFirst({
      where: {
        OR: [
          { externalSubscriptionId: { in: ev.ids } },
          { gatewaySubscriptionId: { in: ev.ids } },
        ],
      },
      orderBy: { startedAt: 'desc' },
    })
    if (!sub) {
      // Renovação que não casa com nenhuma assinatura é cliente pagando sem receber o
      // Premium: precisa ficar visível, não sumir em silêncio.
      console.error(`[webhook] evento ${ev.name} sem assinatura correspondente (ids: ${ev.ids.join(', ')})`)
      return { received: true }
    }

    // Guarda o id da assinatura recorrente (subs_...) para casar as renovações futuras
    const gatewaySubId = ev.ids.find((i) => i.startsWith('subs_'))
    if (gatewaySubId && sub.gatewaySubscriptionId !== gatewaySubId) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { gatewaySubscriptionId: gatewaySubId } })
    }

    if (ev.name === 'subscription.completed' || ev.name === 'checkout.completed') {
      // PENDING, ou CANCELLED por abandono nosso (o checkout hospedado vive mais que
      // os 30min). EXPIRED/ACTIVE não: um replay de evento antigo reativaria o Premium.
      if (sub.status === 'PENDING' || sub.status === 'CANCELLED') {
        await this.reconcileOne(sub)
      }
      return { received: true }
    }

    if (ev.name === 'subscription.renewed') {
      if (await this.alreadyProcessed('SUBSCRIPTION_RENEWED', ev.eventId)) {
        return { received: true, duplicate: true }
      }
      await this.renewSubscription(sub, ev.eventId)
      return { received: true }
    }

    if (ev.name === 'subscription.cancelled') {
      // Cancelada no gateway (pelo cliente ou após esgotar as retentativas de cobrança).
      // O período já pago continua valendo até expiresAt; só não haverá nova renovação —
      // por isso deixa de ser "recorrente": o editor pode reassinar quando quiser.
      await prisma.subscription.update({ where: { id: sub.id }, data: { recurring: false } })
      await logEvent({
        actorId: null,
        action: 'SUBSCRIPTION_CANCELLED',
        entityType: 'Subscription',
        entityId: sub.id,
        metadata: { eventId: ev.eventId },
      })
    }

    return { received: true }
  }

  /** O gateway repete o mesmo evento (mesmo id) em retentativas; sem isto cada repetição estenderia o Premium de novo. */
  private async alreadyProcessed(action: 'SUBSCRIPTION_RENEWED', eventId: string | null) {
    if (!eventId) return false
    const prev = await prisma.auditLog.findFirst({
      where: { action, metadata: { path: ['eventId'], equals: eventId } },
      select: { id: true },
    })
    return Boolean(prev)
  }

  /** Cobrança recorrente paga: estende o Premium por mais um período. */
  private async renewSubscription(sub: Subscription, eventId: string | null) {
    const profile = await prisma.editorProfile.findUnique({ where: { id: sub.editorProfileId } })
    const currentExpiry = profile?.premiumExpiresAt
    const base = currentExpiry && currentExpiry.getTime() > Date.now() ? currentExpiry.getTime() : Date.now()
    const expiresAt = new Date(base + PERIOD_DAYS * DAY_MS)

    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE', expiresAt } }),
      prisma.editorProfile.update({
        where: { id: sub.editorProfileId },
        data: { isPremium: true, premiumExpiresAt: expiresAt },
      }),
    ])

    await logEvent({
      actorId: null,
      action: 'SUBSCRIPTION_RENEWED',
      entityType: 'Subscription',
      entityId: sub.id,
      metadata: { eventId, expiresAt: expiresAt.toISOString() },
    })
  }

  /**
   * Expira assinaturas vencidas e reverte o isPremium do editor.
   * Chamado oportunisticamente no login (sem necessidade de cron por enquanto).
   */
  async checkAndExpireSubscriptions() {
    const now = new Date()
    const expired = await prisma.subscription.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: now } },
      select: { id: true, editorProfileId: true },
    })
    if (expired.length === 0) return

    await prisma.$transaction([
      prisma.subscription.updateMany({
        where: { id: { in: expired.map((s) => s.id) } },
        data: { status: 'EXPIRED' },
      }),
      prisma.editorProfile.updateMany({
        where: { id: { in: expired.map((s) => s.editorProfileId) } },
        data: { isPremium: false, premiumExpiresAt: null },
      }),
    ])
  }
}

export const subscriptionService = new SubscriptionService()
