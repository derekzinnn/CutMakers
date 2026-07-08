import { api } from './api'
import type { OrderStatus, TransactionStatus } from './orders'

export interface MyPayment {
  id: string
  amount: number
  platformFee: number
  status: TransactionStatus
  externalPaymentId: string | null
  createdAt: string
  order: {
    id: string
    title: string
    status: OrderStatus
    editorName: string
    categoryName: string
  }
}

export interface PaymentsSummary {
  totalPaid: number
  totalHeld: number
  totalCompleted: number
}

export interface MyPaymentsResponse {
  payments: MyPayment[]
  summary: PaymentsSummary
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getMyPayments(page = 1): Promise<MyPaymentsResponse> {
  const { data } = await api.get<MyPaymentsResponse>('/payments/me', { params: { page } })
  return data
}
