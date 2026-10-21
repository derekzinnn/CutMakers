import { listOrders, type OrderDTO, type ListOrdersParams } from '@/lib/orders'
import { useCached } from './use-cached'

/**
 * A chave inclui os filtros: trocar o status NÃO descarta o cache do anterior,
 * então alternar entre chips de filtro fica instantâneo depois da primeira vez.
 */
function chaveDe({ role, status, page, limit }: ListOrdersParams) {
  return ['orders', role ?? 'all', status ?? 'all', page ?? 1, limit ?? 20].join(':')
}

export function useOrders(params: ListOrdersParams = {}) {
  const { role, status, page, limit } = params

  const { dado, carregando, erro, recarregar } = useCached<{
    orders: OrderDTO[]
    total: number
  }>(chaveDe({ role, status, page, limit }), async () => {
    const d = await listOrders({ role, status, page, limit })
    return { orders: d.orders, total: d.total }
  })

  return {
    orders: dado?.orders ?? [],
    total: dado?.total ?? 0,
    loading: carregando,
    error: erro,
    refetch: recarregar,
  }
}
