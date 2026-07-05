import { STATUS_LABELS, type OrderDTO, type OrderStatus } from '@/lib/orders'

/**
 * Chips de filtro por status de pedido, com contagem por status.
 * Só exibe chips de status que existem na lista atual (evita poluição visual).
 */

const FILTER_ORDER: OrderStatus[] = [
  'NEGOTIATING',
  'AWAITING_PAYMENT',
  'PENDING',
  'ACCEPTED',
  'IN_PROGRESS',
  'DELIVERED',
  'REVISION_REQUESTED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
]

interface Props {
  orders: OrderDTO[]
  active: OrderStatus | 'ALL'
  onChange: (status: OrderStatus | 'ALL') => void
}

export function filterOrdersByStatus(orders: OrderDTO[], status: OrderStatus | 'ALL') {
  return status === 'ALL' ? orders : orders.filter((o) => o.status === status)
}

export function OrderStatusFilter({ orders, active, onChange }: Props) {
  const counts = new Map<OrderStatus, number>()
  for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1)

  const available = FILTER_ORDER.filter((s) => (counts.get(s) ?? 0) > 0)
  if (orders.length === 0) return null

  const chip = (label: string, value: OrderStatus | 'ALL', count: number) => {
    const isActive = active === value
    return (
      <button
        key={value}
        onClick={() => onChange(value)}
        className="rounded-full px-3 py-1 text-xs transition-colors"
        style={{
          background: isActive ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.05)',
          color: isActive ? '#F4631E' : 'rgba(255,255,255,0.6)',
          border: `1px solid ${isActive ? 'rgba(244,99,30,0.3)' : 'rgba(255,255,255,0.08)'}`,
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {label}
        <span style={{ marginLeft: 5, opacity: 0.6, fontSize: 10 }}>{count}</span>
      </button>
    )
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {chip('Todos', 'ALL', orders.length)}
      {available.map((s) => chip(STATUS_LABELS[s], s, counts.get(s) ?? 0))}
    </div>
  )
}
