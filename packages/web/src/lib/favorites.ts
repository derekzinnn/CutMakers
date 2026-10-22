import { api } from './api'

export interface FavoriteEditor {
  favoritedAt: string
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  bio: string | null
  isPremium: boolean
  avgRating: number
  totalJobs: number
  categories: { id: string; name: string }[]
  portfolioPreview: { id: string; title: string; thumbnailUrl: string | null; basePrice: number }[]
}

/** Alterna o favorito de um editor. Retorna o estado final. */
export async function toggleFavorite(editorUserId: string): Promise<{ favorited: boolean }> {
  const { data } = await api.post<{ favorited: boolean }>(`/favorites/${editorUserId}/toggle`)
  return data
}

/** userIds dos editores favoritados — para marcar os corações na busca. */
export async function listFavoriteIds(): Promise<string[]> {
  const { data } = await api.get<{ editorUserIds: string[] }>('/favorites/ids')
  return data.editorUserIds
}

/** Editores favoritados, com os dados do card. */
export async function listFavorites(): Promise<FavoriteEditor[]> {
  const { data } = await api.get<{ editors: FavoriteEditor[] }>('/favorites')
  return data.editors
}
