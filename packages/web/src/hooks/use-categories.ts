import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export interface Category {
  id: string
  name: string
}

let cache: Category[] | null = null

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(cache ?? [])
  const [loading, setLoading] = useState(!cache)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cache) return
    let cancel = false
    setLoading(true)

    api
      .get<{ categories: Category[] }>('/categories')
      .then(({ data }) => {
        if (cancel) return
        cache = data.categories
        setCategories(data.categories)
      })
      .catch((err) => {
        if (cancel) return
        setError(err?.response?.data?.message ?? 'Erro ao carregar categorias')
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })

    return () => {
      cancel = true
    }
  }, [])

  return { categories, loading, error }
}
