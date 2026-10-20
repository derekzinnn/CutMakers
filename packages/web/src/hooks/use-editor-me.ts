import { api } from '@/lib/api'
import { useCached } from './use-cached'

export interface EditorMe {
  id: string
  name: string
  email: string
  role: 'CREATOR' | 'EDITOR' | 'BOTH' | 'ADMIN'
  avatarUrl: string | null
  bio: string | null
  createdAt: string
  profile: {
    id: string
    isPremium: boolean
    premiumExpiresAt: string | null
    avgRating: number
    totalJobs: number
    categories: { id: string; name: string }[]
    portfolioItems: {
      id: string
      title: string
      description: string | null
      videoUrl: string
      thumbnailUrl: string | null
      basePrice: number
      category: { id: string; name: string }
      createdAt: string
    }[]
  }
}

export function useEditorMe() {
  const { dado, carregando, erro, recarregar } = useCached<EditorMe>(
    'editor-me',
    async () => (await api.get<{ editor: EditorMe }>('/editors/me')).data.editor,
  )

  return { editor: dado, loading: carregando, error: erro, refetch: recarregar }
}
