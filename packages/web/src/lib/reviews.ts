import { api } from './api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ReviewDTO {
  id: string
  orderId: string
  rating: number
  comment: string | null
  reviewer: { id: string; name: string; avatarUrl: string | null }
  orderTitle: string | null
  orderCategory: string | null
  createdAt: string
}

export interface ReviewsResponse {
  reviews: ReviewDTO[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function createReview(
  orderId: string,
  data: { rating: number; comment?: string },
): Promise<ReviewDTO> {
  const { data: res } = await api.post<{ review: ReviewDTO }>(`/orders/${orderId}/review`, data)
  return res.review
}

export async function getEditorReviews(
  editorUserId: string,
  params: { page?: number; limit?: number } = {},
): Promise<ReviewsResponse> {
  const { data } = await api.get<ReviewsResponse>(`/editors/${editorUserId}/reviews`, { params })
  return data
}
