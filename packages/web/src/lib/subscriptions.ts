import { api } from './api'

export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'

export interface SubscriptionDTO {
  id: string
  status: SubscriptionStatus
  amount: number
  startedAt: string
  expiresAt: string | null
}

export interface MySubscription {
  isPremium: boolean
  premiumExpiresAt: string | null
  price: number
  subscription: SubscriptionDTO | null
  /** Teto de publicacoes do plano atual */
  portfolioLimit: number
  /** Quantas ja foram publicadas */
  portfolioUsed: number
  /** Teto do Premium, para mostrar o ganho de assinar */
  portfolioLimitPremium: number
  /** Cobranca PIX em aberto (PENDING recente), para a UI oferecer "reabrir" */
  pendingCharge: { pixCode: string | null; paymentUrl: string | null; expiresAt: string | null } | null
}

export interface CreateSubscriptionResult {
  paymentUrl: string | null
  pixCode: string | null
  pixQrCode: string | null
  expiresAt: string | null
  devConfirmed: boolean
  /** true quando reabriu uma cobranca ja existente em vez de criar outra */
  reopened: boolean
}

export async function getMySubscription(): Promise<MySubscription> {
  const { data } = await api.get<MySubscription>('/subscriptions/me')
  return data
}

export async function createSubscription(): Promise<CreateSubscriptionResult> {
  const { data } = await api.post<CreateSubscriptionResult>('/subscriptions')
  return data
}
