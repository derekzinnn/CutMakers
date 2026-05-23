import { api } from './api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED'

export interface ProposalUserRef {
  id: string
  name: string
  avatarUrl: string | null
}

export interface ProposalDTO {
  id: string
  orderId: string
  proposedBy: string
  user: ProposalUserRef
  amount: number
  platformFee: number
  netAmount: number
  message: string | null
  status: ProposalStatus
  createdAt: string
}

export interface CreateProposalPayload {
  amount: number
  message?: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getProposals(orderId: string): Promise<ProposalDTO[]> {
  const { data } = await api.get<{ proposals: ProposalDTO[] }>(`/orders/${orderId}/proposals`)
  return data.proposals
}

export async function createProposal(orderId: string, payload: CreateProposalPayload): Promise<ProposalDTO> {
  const { data } = await api.post<{ proposal: ProposalDTO }>(`/orders/${orderId}/proposals`, payload)
  return data.proposal
}

export async function acceptProposal(orderId: string, proposalId: string): Promise<ProposalDTO> {
  const { data } = await api.post<{ proposal: ProposalDTO }>(
    `/orders/${orderId}/proposals/${proposalId}/accept`,
  )
  return data.proposal
}

export async function rejectProposal(orderId: string, proposalId: string): Promise<ProposalDTO> {
  const { data } = await api.post<{ proposal: ProposalDTO }>(
    `/orders/${orderId}/proposals/${proposalId}/reject`,
  )
  return data.proposal
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  PENDING: 'Aguardando resposta',
  ACCEPTED: 'Aceita',
  REJECTED: 'Rejeitada',
  COUNTERED: 'Contraoferta enviada',
}
