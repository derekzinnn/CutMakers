import { api } from './api'

export type DisputeStatus = 'OPEN' | 'RESOLVED_RELEASED' | 'RESOLVED_REFUNDED'
export type DisputeResolution = 'RELEASE' | 'REFUND'

export interface DisputeDTO {
  id: string
  orderId: string
  reason: string
  resolution: string | null
  status: DisputeStatus
  openedById: string
  resolvedById: string | null
  createdAt: string
  resolvedAt: string | null
}

export async function openDispute(orderId: string, reason: string): Promise<DisputeDTO> {
  const { data } = await api.post<{ dispute: DisputeDTO }>(`/orders/${orderId}/dispute`, { reason })
  return data.dispute
}

export async function resolveDispute(orderId: string, resolution: DisputeResolution): Promise<DisputeDTO> {
  const { data } = await api.post<{ dispute: DisputeDTO }>(`/orders/${orderId}/dispute/resolve`, { resolution })
  return data.dispute
}
