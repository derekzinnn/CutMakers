import { Subscription } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { BadRequest, NotFound } from '../lib/errors'
import { paymentService } from './payment.service'
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

    const charge = await paymentService.createPixCharge({
      amount: PREMIUM_MONTHLY_PRICE,
      externalId: subscription.id,
      productName: 'CutMakers Premium (mensal)',
      customer: { name: profile.user.name, email: profile.user.email },
      returnPath: '/dashboard/editor',
    })

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        externalSubscriptionId: charge.externalPaymentId,
        paymentUrl: charge.paymentUrl,
        pixCode: charge.pixCode,
        pixQrCode: charge.pixQrCode,
        chargeExpiresAt: charge.expiresAt ? new Date(charge.expiresAt) : null,
      },
    })

    // Em dev (sem gateway) confirmamos na hora para o fluxo de demonstração seguir
    if (charge.devMode) {
      await this.confirmSubscriptionPayment(subscription.id)
    }

    return {
      paymentUrl: charge.paymentUrl,
      pixCode: charge.pixCode,
      pixQrCode: charge.pixQrCode,
      expiresAt: charge.expiresAt,
      devConfirmed: charge.devMode,
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

    // Cobranca em aberto so conta se for PENDING recente (dentro do TTL) e tiver PIX
    const pendingCharge =
      subscription &&
      subscription.status === 'PENDING' &&
      subscription.pixCode &&
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
