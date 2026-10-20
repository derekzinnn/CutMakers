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

export interface ConversationsPage {
  conversations: ConversationDTO[]
  total: number
  page: number
  totalPages: number
}

/** Paginada: a lista cresce uma conversa por pedido. */
export async function listConversations(page = 1): Promise<ConversationsPage> {
  const { data } = await api.get<ConversationsPage>('/conversations', { params: { page } })
  return data
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
