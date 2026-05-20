import { IconCalendar, IconFile, IconMessages } from '@tabler/icons-react'
import { STATUS_COLORS, STATUS_LABELS, type OrderDTO } from '@/lib/orders'

interface Props {
  order: OrderDTO
  /** Define qual contraparte mostrar no card. */
  perspective: 'creator' | 'editor'
  onClick?: () => void
}

export function OrderCard({ order, perspective, onClick }: Props) {
  const counterpart = perspective === 'creator' ? order.editor : order.creator
  const counterpartLabel = perspective === 'creator' ? 'Editor' : 'Creator'
  const statusColor = STATUS_COLORS[order.status]

  return (
    <div
      onClick={onClick}
      className="rounded-card p-5 transition-all"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-heading text-base font-semibold text-white">
            {order.title}
          </h3>
          <p className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {order.category.name}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: `${statusColor}1A`,
            color: statusColor,
            border: `1px solid ${statusColor}33`,
          }}
        >
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <p
        className="mb-4 line-clamp-2 text-xs"
        style={{ color: 'rgba(255,255,255,0.6)' }}
      >
        {order.description}
      </p>

      {/* Contraparte + valor */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-[10px] font-bold text-white"
            style={{ background: '#F4631E' }}
          >
            {counterpart.avatarUrl ? (
              <img src={counterpart.avatarUrl} alt={counterpart.name} className="h-full w-full object-cover" />
            ) : (
              counterpart.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {counterpartLabel}
            </p>
            <p className="text-xs text-white">{counterpart.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Orçamento
          </p>
          <p className="font-heading text-sm font-bold text-white">
            R$ {order.budget.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Metadados */}
      <div
        className="flex flex-wrap items-center gap-3 pt-3 text-[11px]"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
      >
        {order.deadline && (
          <span className="flex items-center gap-1">
            <IconCalendar size={11} stroke={1.5} />
            {new Date(order.deadline).toLocaleDateString('pt-BR')}
          </span>
        )}
        {order.files.length > 0 && (
          <span className="flex items-center gap-1">
            <IconFile size={11} stroke={1.5} />
            {order.files.length} {order.files.length === 1 ? 'arquivo' : 'arquivos'}
          </span>
        )}
        {order.deliveriesCount > 0 && (
          <span className="flex items-center gap-1">
            <IconMessages size={11} stroke={1.5} />
            {order.deliveriesCount} {order.deliveriesCount === 1 ? 'entrega' : 'entregas'}
          </span>
        )}
        <span className="ml-auto">
          {new Date(order.createdAt).toLocaleDateString('pt-BR')}
        </span>
      </div>
    </div>
  )
}
