import { api } from './api'
import type { ProposalDTO } from './proposals'
import type { RevisionDTO } from './revisions'
import type { DisputeDTO } from './disputes'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'NEGOTIATING'
  | 'AWAITING_PAYMENT'
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'REVISION_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'

export type TransactionStatus = 'PENDING' | 'HELD' | 'RELEASED' | 'REFUNDED'

export interface OrderFile {
  id: string
  fileUrl: string
  fileName: string
  fileType: string
  uploadedAt: string
}

export interface OrderDelivery {
  id: string
  videoUrl: string
  message: string | null
  version: number
  createdAt: string
}

export interface OrderTransaction {
  id: string
  status: TransactionStatus
  amount: number
  platformFee: number
  netAmount: number
  externalPaymentId: string | null
  createdAt: string
}

export interface OrderUserRef {
  id: string
  name: string
  avatarUrl: string | null
}

export interface OrderDTO {
  id: string
  title: string
  description: string
  status: OrderStatus
  budget: number
  platformFee: number
  deadline: string | null
  category: { id: string; name: string }
  creator: OrderUserRef
  editor: OrderUserRef
  files: OrderFile[]
  deliveriesCount: number
  revisionsCount: number
  createdAt: string
  updatedAt: string
}

export interface OrderReview {
  id: string
  rating: number
  comment: string | null
  reviewer: { id: string; name: string; avatarUrl: string | null }
  createdAt: string
}

export interface OrderDetailDTO extends OrderDTO {
  deliveries: OrderDelivery[]
  transaction: OrderTransaction | null
  review: OrderReview | null
  proposals: ProposalDTO[]
  revisions: RevisionDTO[]
  dispute: DisputeDTO | null
  filesHidden: boolean
}

export interface CreateOrderPayload {
  editorId: string
  categoryId: string
  portfolioItemId?: string
  title: string
  description: string
  budget: number
  deadline?: string
  files: { fileUrl: string; fileName: string; fileType: string }[]
}

export interface ListOrdersResponse {
  orders: OrderDTO[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ListOrdersParams {
  role?: 'creator' | 'editor'
  status?: OrderStatus
  page?: number
  limit?: number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function createOrder(payload: CreateOrderPayload): Promise<OrderDTO> {
  const { data } = await api.post<{ order: OrderDTO }>('/orders', payload)
  return data.order
}

export async function listOrders(params: ListOrdersParams = {}): Promise<ListOrdersResponse> {
  const { data } = await api.get<ListOrdersResponse>('/orders', { params })
  return data
}

export async function getOrder(id: string): Promise<OrderDetailDTO> {
  const { data } = await api.get<{ order: OrderDetailDTO }>(`/orders/${id}`)
  return data.order
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<OrderDetailDTO> {
  const { data } = await api.patch<{ order: OrderDetailDTO }>(`/orders/${id}/status`, { status })
  return data.order
}

export async function createDelivery(
  orderId: string,
  payload: { videoUrl: string; message?: string },
): Promise<OrderDelivery> {
  const { data } = await api.post<{ delivery: OrderDelivery }>(`/orders/${orderId}/deliveries`, payload)
  return data.delivery
}

export interface InitiatePaymentResult {
  paymentUrl: string | null
  pixCode: string | null
  pixQrCode: string | null
  expiresAt: string | null
}

export async function initiatePayment(orderId: string): Promise<InitiatePaymentResult> {
  const { data } = await api.post<InitiatePaymentResult>(`/orders/${orderId}/payment`)
  return data
}

export async function addOrderFiles(
  orderId: string,
  files: { fileUrl: string; fileName: string; fileType: string }[],
): Promise<void> {
  await api.post(`/orders/${orderId}/files`, { files })
}

// ─── Labels e cores por status ───────────────────────────────────────────────

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEGOTIATING: 'Negociando',
  AWAITING_PAYMENT: 'Aguardando pagamento',
  PENDING: 'Pendente',
  ACCEPTED: 'Aceito',
  IN_PROGRESS: 'Em andamento',
  DELIVERED: 'Entregue',
  REVISION_REQUESTED: 'Revisão solicitada',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  DISPUTED: 'Em disputa',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  NEGOTIATING: '#F4631E',
  AWAITING_PAYMENT: '#EAB308',
  PENDING: '#F4631E',
  ACCEPTED: '#3B82F6',
  IN_PROGRESS: '#3B82F6',
  DELIVERED: '#A855F7',
  REVISION_REQUESTED: '#EAB308',
  COMPLETED: '#22C55E',
  CANCELLED: '#EF4444',
  DISPUTED: '#EF4444',
}

export const TRANSACTION_LABELS: Record<TransactionStatus, string> = {
  PENDING: 'Aguardando pagamento',
  HELD: 'Pagamento retido (escrow)',
  RELEASED: 'Pagamento liberado',
  REFUNDED: 'Reembolsado',
}
