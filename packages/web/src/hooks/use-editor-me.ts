import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'

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
  const [editor, setEditor] = useState<EditorMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<{ editor: EditorMe }>('/editors/me')
      setEditor(data.editor)
    } catch (err) {
      const e = err as { response?: { data?: { message?: string }; status?: number } }
      // 404 = ainda não tem perfil, será criado ao salvar
      if (e?.response?.status !== 404) {
        setError(e?.response?.data?.message ?? 'Erro ao carregar perfil')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { editor, loading, error, refetch }
}
