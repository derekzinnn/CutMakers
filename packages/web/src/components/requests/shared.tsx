import { IconChevronLeft, IconChevronRight, IconLoader2, IconStarFilled } from '@tabler/icons-react'

// ─── Formatação ───────────────────────────────────────────────────────────────

export function fmtBRL(n: number) {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function budgetLabel(min: number | null, max: number | null) {
  if (min !== null && max !== null) return min === max ? fmtBRL(min) : `${fmtBRL(min)} – ${fmtBRL(max)}`
  if (min !== null) return `a partir de ${fmtBRL(min)}`
  if (max !== null) return `até ${fmtBRL(max)}`
  return 'A combinar'
}

export function deadlineLabel(iso: string | null): { text: string; color: string } | null {
  if (!iso) return null
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  if (days < 0) return { text: 'Prazo vencido', color: '#EF4444' }
  if (days === 0) return { text: 'Prazo: hoje', color: '#EF4444' }
  if (days <= 3) return { text: `Prazo em ${days}d`, color: '#EAB308' }
  return { text: `Prazo em ${days}d`, color: 'rgba(255,255,255,0.5)' }
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ─── Primitivos visuais ───────────────────────────────────────────────────────

export function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: `${color}1A`, color, border: `1px solid ${color}33` }}
    >
      {label}
    </span>
  )
}

const AVATAR_PALETTE = ['#F4631E', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']

export function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_PALETTE.length
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-heading font-bold text-white"
      style={{ width: size, height: size, background: AVATAR_PALETTE[h], fontSize: size * 0.38 }}
    >
      {url ? <img src={url} alt={name} className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
    </div>
  )
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
      <IconStarFilled size={12} style={{ color: '#F4631E' }} />
      {rating > 0 ? rating.toFixed(1) : 'Novo'}
    </span>
  )
}

export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <IconLoader2 size={26} className="animate-spin" style={{ color: '#F4631E' }} />
    </div>
  )
}

export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode
  title: string
  text: string
  action?: React.ReactNode
}) {
  return (
    <div
      className="rounded-[12px] p-12 text-center"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'rgba(244,99,30,0.1)' }}
      >
        {icon}
      </div>
      <h3 className="font-heading text-base font-bold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  const btn = (disabled: boolean, onClick: () => void, icon: React.ReactNode) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-[8px]"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon}
    </button>
  )
  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Página {page} de {totalPages}</span>
      <div className="flex gap-2">
        {btn(page <= 1, () => onPage(page - 1), <IconChevronLeft size={15} stroke={1.5} />)}
        {btn(page >= totalPages, () => onPage(page + 1), <IconChevronRight size={15} stroke={1.5} />)}
      </div>
    </div>
  )
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  busy,
  type = 'button',
  form,
  tone = 'orange',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
  type?: 'button' | 'submit'
  form?: string
  tone?: 'orange' | 'green' | 'red'
}) {
  const bg = tone === 'green' ? '#22C55E' : tone === 'red' ? '#EF4444' : '#F4631E'
  const off = disabled || busy
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={off}
      className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold"
      style={{
        background: bg,
        color: 'white',
        border: 'none',
        cursor: off ? 'not-allowed' : 'pointer',
        opacity: off ? 0.6 : 1,
        fontFamily: "'Syne', sans-serif",
      }}
    >
      {busy && <IconLoader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-xs font-medium"
      style={{
        background: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
        color: danger ? '#EF4444' : 'rgba(255,255,255,0.7)',
        border: `1px solid ${danger ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}

export const labelStyle: React.CSSProperties = { color: 'rgba(255,255,255,0.7)' }

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      className="rounded-[8px] px-3 py-2 text-xs"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}
    >
      {message}
    </p>
  )
}
