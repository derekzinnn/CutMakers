import { api } from './api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type RequestStatus = 'OPEN' | 'FILLED' | 'CANCELLED'
export type RequestProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'

export interface CategoryRef {
  id: string
  name: string
}

export interface RequestProposal {
  id: string
  amount: number
  deliveryDays: number
  message: string
  status: RequestProposalStatus
  createdAt: string
  updatedAt: string
}

/** Item de "Minhas solicitações" (creator) */
export interface MyRequest {
  id: string
  title: string
  description: string
  category: CategoryRef
  budgetMin: number | null
  budgetMax: number | null
  deadline: string | null
  revisionsIncluded: number
  referenceLinks: string[]
  status: RequestStatus
  proposalCount: number
  pendingProposalCount: number
  orderId: string | null
  createdAt: string
  updatedAt: string
}

export interface CreatorProposal extends RequestProposal {
  editor: {
    id: string
    name: string
    avatarUrl: string | null
    avgRating: number
    totalJobs: number
    isPremium: boolean
  }
}

export interface CreatorRequestDetail {
  id: string
  title: string
  description: string
  referenceLinks: string[]
  category: CategoryRef
  creator: { id: string; name: string; avatarUrl: string | null }
  budgetMin: number | null
  budgetMax: number | null
  deadline: string | null
  revisionsIncluded: number
  status: RequestStatus
  proposalCount: number
  orderId: string | null
  proposals: CreatorProposal[]
  createdAt: string
  updatedAt: string
}

export interface EditorRequestDetail {
  id: string
  title: string
  description: string
  referenceLinks: string[]
  category: CategoryRef
  creator: { id: string; name: string; avatarUrl: string | null }
  budgetMin: number | null
  budgetMax: number | null
  deadline: string | null
  revisionsIncluded: number
  status: RequestStatus
  proposalCount: number
  myProposal: RequestProposal | null
  createdAt: string
}

export type RequestDetailResponse =
  | { perspective: 'creator'; request: CreatorRequestDetail }
  | { perspective: 'editor'; request: EditorRequestDetail }

/** Item do quadro de oportunidades (editor) — sem descrição completa nem links */
export interface BoardRequest {
  id: string
  title: string
  descriptionPreview: string
  category: CategoryRef
  creator: { id: string; name: string; avatarUrl: string | null }
  budgetMin: number | null
  budgetMax: number | null
  deadline: string | null
  revisionsIncluded: number
  proposalCount: number
  myProposal: { status: RequestProposalStatus } | null
  createdAt: string
}

export interface MyProposal extends RequestProposal {
  request: {
    id: string
    title: string
    status: RequestStatus
    category: CategoryRef
    creatorName: string
  }
  orderId: string | null
}

interface Paginated {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface RequestPayload {
  categoryId: string
  title: string
  description: string
  budgetMin?: number
  budgetMax?: number
  deadline?: string
  revisionsIncluded?: number
  referenceLinks?: string[]
}

export interface RequestUpdatePayload {
  title?: string
  description?: string
  budgetMin?: number | null
  budgetMax?: number | null
  deadline?: string | null
  referenceLinks?: string[]
}

export interface ProposalPayload {
  amount: number
  deliveryDays: number
  message: string
}

// ─── Creator ──────────────────────────────────────────────────────────────────

export async function createRequest(payload: RequestPayload): Promise<MyRequest> {
  const { data } = await api.post<{ request: MyRequest }>('/requests', payload)
  return data.request
}

export async function listMyRequests(page = 1) {
  const { data } = await api.get<Paginated & { requests: MyRequest[]; pendingProposalsTotal: number }>(
    '/requests/mine',
    { params: { page } },
  )
  return data
}

export async function updateRequest(id: string, payload: RequestUpdatePayload): Promise<MyRequest> {
  const { data } = await api.patch<{ request: MyRequest }>(`/requests/${id}`, payload)
  return data.request
}

export async function cancelRequest(id: string) {
  const { data } = await api.post<{ id: string; status: 'CANCELLED'; rejectedProposals: number }>(
    `/requests/${id}/cancel`,
  )
  return data
}

export async function acceptRequestProposal(requestId: string, proposalId: string) {
  const { data } = await api.post<{ orderId: string; amount: number; platformFee: number; rejectedCount: number }>(
    `/requests/${requestId}/proposals/${proposalId}/accept`,
  )
  return data
}

export async function rejectRequestProposal(requestId: string, proposalId: string) {
  const { data } = await api.post<{ proposal: RequestProposal }>(`/requests/${requestId}/proposals/${proposalId}/reject`)
  return data.proposal
}

// ─── Compartilhado ────────────────────────────────────────────────────────────

export async function getRequest(id: string, sort: 'amount' | 'rating' = 'amount') {
  const { data } = await api.get<RequestDetailResponse>(`/requests/${id}`, { params: { sort } })
  return data
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export interface BoardFilters {
  category?: string
  search?: string
  budgetMin?: number
  budgetMax?: number
  sort?: 'recent' | 'budget_desc'
  page?: number
}

export async function listOpenRequests(filters: BoardFilters) {
  const { data } = await api.get<Paginated & { requests: BoardRequest[] }>('/requests', { params: filters })
  return data
}

export async function sendRequestProposal(requestId: string, payload: ProposalPayload) {
  const { data } = await api.post<{ proposal: RequestProposal }>(`/requests/${requestId}/proposals`, payload)
  return data.proposal
}

export async function updateMyRequestProposal(requestId: string, payload: Partial<ProposalPayload>) {
  const { data } = await api.patch<{ proposal: RequestProposal }>(`/requests/${requestId}/proposals/mine`, payload)
  return data.proposal
}

export async function withdrawMyRequestProposal(requestId: string) {
  const { data } = await api.delete<{ proposal: RequestProposal }>(`/requests/${requestId}/proposals/mine`)
  return data.proposal
}

export async function listMyProposals(page = 1) {
  const { data } = await api.get<Paginated & { proposals: MyProposal[] }>('/requests/proposals/mine', {
    params: { page },
  })
  return data
}

// ─── Labels / cores ───────────────────────────────────────────────────────────

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  OPEN: 'Aberta',
  FILLED: 'Fechada',
  CANCELLED: 'Cancelada',
}

export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  OPEN: '#F4631E',
  FILLED: '#22C55E',
  CANCELLED: '#EF4444',
}

export const PROPOSAL_STATUS_LABELS: Record<RequestProposalStatus, string> = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceita',
  REJECTED: 'Recusada',
  WITHDRAWN: 'Retirada',
}

export const PROPOSAL_STATUS_COLORS: Record<RequestProposalStatus, string> = {
  PENDING: '#EAB308',
  ACCEPTED: '#22C55E',
  REJECTED: '#EF4444',
  WITHDRAWN: '#94A3B8',
}

export const PLATFORM_FEE_RATE = 0.1

export function errorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
  const fieldErrors = e?.response?.data?.errors
  const firstField = fieldErrors ? Object.values(fieldErrors).flat()[0] : undefined
  return firstField ?? e?.response?.data?.message ?? fallback
}
