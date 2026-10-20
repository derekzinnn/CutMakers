import { api } from '@/lib/api'
import { TTL_LONGO } from '@/lib/cache'
import { useCached } from './use-cached'

export interface Category {
  id: string
  name: string
}

/**
 * Antes isto tinha um cache caseiro PERMANENTE (`let cache` no módulo), que
 * nunca invalidava: criar uma categoria pelo portfólio ("Outros" com nome
 * livre) não a fazia aparecer até dar F5. Agora é TTL de 5min e o
 * `invalidar('categories')` do portfólio derruba na hora.
 */
export function useCategories() {
  const { dado, carregando, erro } = useCached<Category[]>(
    'categories',
    async () => (await api.get<{ categories: Category[] }>('/categories')).data.categories,
    { ttl: TTL_LONGO },
  )

  return { categories: dado ?? [], loading: carregando, error: erro }
}
