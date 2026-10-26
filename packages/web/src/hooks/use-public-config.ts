import { api } from '@/lib/api'
import { TTL_LONGO } from '@/lib/cache'
import { useCached } from './use-cached'

export interface PublicConfig {
  /** Sem chave do gateway: cobranças são simuladas e confirmam na hora */
  paymentsSimulated: boolean
}

export function usePublicConfig() {
  const { dado } = useCached<PublicConfig>(
    'public-config',
    async () => (await api.get<PublicConfig>('/config')).data,
    { ttl: TTL_LONGO },
  )
  return dado
}
