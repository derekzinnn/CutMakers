import { api } from './api'

export type RevisionStatus = 'PENDING' | 'ADDRESSED'

export interface RevisionDTO {
  id: string
  orderId: string
  description: string
  status: RevisionStatus
  deliveryId: string
  deliveryVersion: number
  createdAt: string
  requestedBy: { id: string; name: string; avatarUrl: string | null }
}

export const REVISION_STATUS_LABELS: Record<RevisionStatus, string> = {
  PENDING: 'Pendente',
  ADDRESSED: 'Resolvida',
}

export async function createRevision(
  orderId: string,
  payload: { deliveryId: string; description: string },
): Promise<RevisionDTO> {
  const { data } = await api.post<{ revision: RevisionDTO }>(`/orders/${orderId}/revisions`, payload)
  return data.revision
}

export async function listRevisions(orderId: string): Promise<RevisionDTO[]> {
  const { data } = await api.get<{ revisions: RevisionDTO[] }>(`/orders/${orderId}/revisions`)
  return data.revisions
}
