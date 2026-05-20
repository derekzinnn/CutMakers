import { useCallback, useEffect, useState } from 'react'
import { listOrders, type OrderDTO, type ListOrdersParams } from '@/lib/orders'

export function useOrders(params: ListOrdersParams = {}) {
  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { role, status, page, limit } = params

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listOrders({ role, status, page, limit })
      setOrders(data.orders)
      setTotal(data.total)
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      setError(err?.response?.data?.message ?? 'Erro ao carregar pedidos')
    } finally {
      setLoading(false)
    }
  }, [role, status, page, limit])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { orders, total, loading, error, refetch: fetch }
}
