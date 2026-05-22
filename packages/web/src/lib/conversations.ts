import { api } from './api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ChatUser {
  id: string
  name: string
  avatarUrl: string | null
}

export interface MessageDTO {
  id: string
  conversationId: string
  sender: ChatUser
  content: string
  readAt: string | null
  createdAt: string
}

export interface ConversationDTO {
  id: string
  creator: ChatUser
  editor: ChatUser
  order: { id: string; title: string } | null
  lastMessage: {
    content: string
    senderId: string
    createdAt: string
  } | null
  createdAt: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getOrCreateConversationByOrder(orderId: string): Promise<ConversationDTO> {
  const { data } = await api.post<{ conversation: ConversationDTO }>(`/conversations/order/${orderId}`)
  return data.conversation
}

export async function listConversations(): Promise<ConversationDTO[]> {
  const { data } = await api.get<{ conversations: ConversationDTO[] }>('/conversations')
  return data.conversations
}

export async function getMessages(conversationId: string, page = 1): Promise<MessageDTO[]> {
  const { data } = await api.get<{ messages: MessageDTO[] }>(
    `/conversations/${conversationId}/messages`,
    { params: { page } },
  )
  return data.messages
}

export async function sendMessage(conversationId: string, content: string): Promise<MessageDTO> {
  const { data } = await api.post<{ message: MessageDTO }>(
    `/conversations/${conversationId}/messages`,
    { content },
  )
  return data.message
}
