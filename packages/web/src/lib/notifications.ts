import { api } from './api'

export interface NotificationDTO {
  id: string
  type: string
  title: string
  body: string
  readAt: string | null
  relatedOrderId: string | null
  createdAt: string
}

export interface NotificationsResponse {
  notifications: NotificationDTO[]
  unreadCount: number
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  const { data } = await api.get<NotificationsResponse>('/notifications')
  return data
}

export async function markAllRead(): Promise<void> {
  await api.patch('/notifications/read-all')
}

export async function markOneRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`)
}
