import { api } from './api'

export interface AgreementDTO {
  id: string
  orderId: string
  termsVersion: string
  content: string
  creatorAcceptedAt: string | null
  editorAcceptedAt: string | null
  bothAccepted: boolean
  createdAt: string
}

export async function acceptAgreement(orderId: string): Promise<AgreementDTO> {
  const { data } = await api.post<{ agreement: AgreementDTO }>(`/orders/${orderId}/agreement/accept`)
  return data.agreement
}
