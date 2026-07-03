import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconLayoutDashboard,
  IconUsers,
  IconBriefcase,
  IconCreditCard,
  IconCrown,
  IconCamera,
  IconMovie,
  IconLogout,
  IconX,
  IconTrendingUp,
  IconCheck,
  IconClock,
  IconDots,
  IconSearch,
  IconBell,
  IconChevronRight,
  IconChevronLeft,
  IconRss,
  IconFolder,
  IconUserCircle,
  IconLoader2,
  IconBan,
  IconArrowBackUp,
  IconEye,
  IconGavel,
  IconAlertTriangle,
  IconRosetteDiscountCheck,
} from '@tabler/icons-react'
import { Modal } from '@/components/ui/Modal'
import { STATUS_LABELS, STATUS_COLORS, TRANSACTION_LABELS, type OrderStatus, type TransactionStatus } from '@/lib/orders'
import { resolveDispute } from '@/lib/disputes'
import {
  listUsers,
  banUser,
  unbanUser,
  listAdminOrders,
  listAdminDisputes,
  getFinancialSummary,
  listAdminTransactions,
  type AdminUser,
  type AdminOrder,
  type AdminDispute,
  type AdminTransaction,
  type FinancialSummary,
  type UserRole,
} from '@/lib/admin'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ViewMode = 'ADMIN' | 'CREATOR' | 'EDITOR'
type AdminSection = 'dashboard' | 'users' | 'orders' | 'transactions' | 'subscriptions'
type UserSection = 'feed' | 'projects' | 'account'

// ─── Helpers compartilhados ───────────────────────────────────────────────────

const money = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`
const shortId = (id: string) => id.slice(0, 8)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const ROLE_LABELS: Record<UserRole, string> = {
  CREATOR: 'Creator',
  EDITOR: 'Editor',
  BOTH: 'Ambos',
  ADMIN: 'Admin',
}

const TRANSACTION_COLORS: Record<TransactionStatus, string> = {
  PENDING: '#F4631E',
  HELD: '#3B82F6',
  RELEASED: '#22C55E',
  REFUNDED: '#EF4444',
}

const ALL_ORDER_STATUSES: OrderStatus[] = [
  'NEGOTIATING', 'AWAITING_PAYMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS',
  'DELIVERED', 'REVISION_REQUESTED', 'COMPLETED', 'CANCELLED', 'DISPUTED',
]

function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <IconLoader2 size={24} className="animate-spin" style={{ color: '#F4631E' }} />
    </div>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  const navBtn = (disabled: boolean, onClick: () => void, icon: React.ReactNode) => (
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
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        {navBtn(page <= 1, () => onPage(page - 1), <IconChevronLeft size={15} stroke={1.5} />)}
        {navBtn(page >= totalPages, () => onPage(page + 1), <IconChevronRight size={15} stroke={1.5} />)}
      </div>
    </div>
  )
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const color = STATUS_COLORS[status]
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: `${color}1A`, color, border: `1px solid ${color}33` }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function TransactionBadge({ status }: { status: TransactionStatus }) {
  const color = TRANSACTION_COLORS[status]
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: `${color}1A`, color, border: `1px solid ${color}33` }}
    >
      {TRANSACTION_LABELS[status]}
    </span>
  )
}

// ─── Dados mock (substituir por fetch na Fase 2) ──────────────────────────────

const STATS = [
  { label: 'Total de Usuários', value: '0', icon: IconUsers, delta: '+0 este mês' },
  { label: 'Pedidos Ativos', value: '0', icon: IconBriefcase, delta: '+0 esta semana' },
  { label: 'Pedidos Concluídos', value: '0', icon: IconCheck, delta: '+0 este mês' },
  { label: 'Receita Total', value: 'R$ 0,00', icon: IconTrendingUp, delta: '+R$ 0 este mês' },
]

// ─── Componentes internos ─────────────────────────────────────────────────────

function StatsCard({
  label,
  value,
  delta,
  Icon,
}: {
  label: string
  value: string
  delta: string
  Icon: React.ElementType
}) {
  return (
    <div
      className="rounded-card p-5"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {label}
        </span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'rgba(244,99,30,0.1)' }}
        >
          <Icon size={16} stroke={1.5} color="#F4631E" />
        </span>
      </div>
      <p className="font-heading text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {delta}
      </p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <IconDots size={24} stroke={1.5} style={{ color: 'rgba(255,255,255,0.2)' }} />
      </div>
      <p className="text-sm font-medium text-white">Nenhum dado ainda</p>
      <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {message}
      </p>
    </div>
  )
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="font-heading text-base font-semibold text-white">{title}</h2>
      {action}
    </div>
  )
}

// ─── Seções do admin ──────────────────────────────────────────────────────────

function DashboardSection() {
  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {STATS.map((s) => (
          <StatsCard key={s.label} label={s.label} value={s.value} delta={s.delta} Icon={s.icon} />
        ))}
      </div>

      {/* Últimos usuários */}
      <div
        className="rounded-card p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <SectionHeader
          title="Últimos Usuários"
          action={
            <button
              className="flex items-center gap-1 text-xs"
              style={{ color: '#F4631E', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Ver todos <IconChevronRight size={12} />
            </button>
          }
        />
        <EmptyState message="Os usuários cadastrados aparecerão aqui" />
      </div>

      {/* Últimos pedidos */}
      <div
        className="rounded-card p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <SectionHeader
          title="Últimos Pedidos"
          action={
            <button
              className="flex items-center gap-1 text-xs"
              style={{ color: '#F4631E', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Ver todos <IconChevronRight size={12} />
            </button>
          }
        />
        <EmptyState message="Os pedidos criados aparecerão aqui" />
      </div>
    </div>
  )
}

const ROLE_FILTERS: { value: UserRole | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'CREATOR', label: 'Creators' },
  { value: 'EDITOR', label: 'Editores' },
  { value: 'BOTH', label: 'Ambos' },
  { value: 'ADMIN', label: 'Admins' },
]

function UsersSection({ onViewUser }: { onViewUser: (u: AdminUser) => void }) {
  const [rawSearch, setRawSearch] = useState('')
  const search = useDebounced(rawSearch)
  const [role, setRole] = useState<UserRole | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ users: AdminUser[]; totalPages: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<AdminUser | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await listUsers({
        search: search || undefined,
        role: role === 'ALL' ? undefined : role,
        page,
      })
      setData({ users: res.users, totalPages: res.totalPages })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search, role, page])
  useEffect(() => { setPage(1) }, [search, role])

  async function confirmBanToggle() {
    if (!target) return
    setBusy(true)
    try {
      if (target.banned) await unbanUser(target.id)
      else await banUser(target.id)
      setTarget(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-card p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Busca + filtro de role */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <IconSearch size={14} stroke={1.5} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <input
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-56 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((r) => {
            const active = role === r.value
            return (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                className="rounded-full px-3 py-1 text-xs transition-colors"
                style={{
                  background: active ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.05)',
                  color: active ? '#F4631E' : 'rgba(255,255,255,0.6)',
                  border: `1px solid ${active ? 'rgba(244,99,30,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer',
                }}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cabeçalho da tabela */}
      <div className="grid grid-cols-[1.4fr_1.8fr_0.8fr_1fr_0.9fr_1.2fr] gap-4 rounded-[8px] px-4 py-2 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}>
        <span>Nome</span>
        <span>Email</span>
        <span>Role</span>
        <span>Cadastro</span>
        <span>Status</span>
        <span className="text-right">Ações</span>
      </div>

      {loading ? (
        <Spinner />
      ) : !data || data.users.length === 0 ? (
        <EmptyState message="Nenhum usuário encontrado" />
      ) : (
        <div className="mt-1">
          {data.users.map((u) => (
            <div key={u.id} className="grid grid-cols-[1.4fr_1.8fr_0.8fr_1fr_0.9fr_1.2fr] items-center gap-4 border-b px-4 py-3 text-sm" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="flex items-center gap-2 truncate text-white">
                {u.name}
                {u.isPremium && <IconRosetteDiscountCheck size={14} stroke={2} style={{ color: '#F4631E', flexShrink: 0 }} />}
              </span>
              <span className="truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{u.email}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{ROLE_LABELS[u.role]}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fmtDate(u.createdAt)}</span>
              <span>
                {u.banned ? (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>Suspenso</span>
                ) : (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>Ativo</span>
                )}
              </span>
              <div className="flex items-center justify-end gap-2">
                {(u.role === 'EDITOR' || u.role === 'BOTH') && (
                  <button
                    onClick={() => onViewUser(u)}
                    title="Ver perfil"
                    className="flex h-7 w-7 items-center justify-center rounded-[6px]"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
                  >
                    <IconEye size={14} stroke={1.5} />
                  </button>
                )}
                {u.role !== 'ADMIN' && (
                  <button
                    onClick={() => setTarget(u)}
                    title={u.banned ? 'Desbanir' : 'Banir'}
                    className="flex h-7 items-center gap-1 rounded-[6px] px-2 text-[11px] font-medium"
                    style={{
                      background: u.banned ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${u.banned ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      color: u.banned ? '#22C55E' : '#EF4444',
                      cursor: 'pointer',
                    }}
                  >
                    {u.banned ? <IconArrowBackUp size={13} stroke={1.5} /> : <IconBan size={13} stroke={1.5} />}
                    {u.banned ? 'Desbanir' : 'Banir'}
                  </button>
                )}
              </div>
            </div>
          ))}
          <Pagination page={page} totalPages={data.totalPages} onPage={setPage} />
        </div>
      )}

      {/* Modal de confirmação de ban/unban */}
      <Modal
        open={target !== null}
        onClose={() => (busy ? undefined : setTarget(null))}
        title={target?.banned ? 'Desbanir usuário' : 'Suspender usuário'}
        subtitle={target ? `${target.name} · ${target.email}` : undefined}
        footer={
          <>
            <button
              onClick={() => setTarget(null)}
              disabled={busy}
              className="rounded-[8px] px-4 py-2 text-sm"
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)', cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmBanToggle}
              disabled={busy}
              className="flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold"
              style={{
                background: target?.banned ? '#22C55E' : '#EF4444',
                color: 'white', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {busy && <IconLoader2 size={14} className="animate-spin" />}
              {target?.banned ? 'Desbanir' : 'Suspender conta'}
            </button>
          </>
        }
      >
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {target?.banned
            ? 'O usuário poderá voltar a fazer login normalmente.'
            : 'O usuário não poderá mais fazer login enquanto estiver suspenso. Ele verá a mensagem "Conta suspensa. Entre em contato com o suporte."'}
        </p>
      </Modal>
    </div>
  )
}

function OrdersSection({ onOpenOrder }: { onOpenOrder: (id: string) => void }) {
  const [status, setStatus] = useState<OrderStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ orders: AdminOrder[]; totalPages: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [disputes, setDisputes] = useState<AdminDispute[]>([])
  const [resolveTarget, setResolveTarget] = useState<AdminDispute | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [res, disp] = await Promise.all([
        listAdminOrders({ status: status === 'ALL' ? undefined : status, page }),
        listAdminDisputes(),
      ])
      setData({ orders: res.orders, totalPages: res.totalPages })
      setDisputes(disp)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status, page])
  useEffect(() => { setPage(1) }, [status])

  const disputeByOrderId = new Map(disputes.map((d) => [d.order.id, d]))

  return (
    <div className="rounded-card p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Filtro de status */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatus('ALL')}
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: status === 'ALL' ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.05)',
            color: status === 'ALL' ? '#F4631E' : 'rgba(255,255,255,0.6)',
            border: `1px solid ${status === 'ALL' ? 'rgba(244,99,30,0.3)' : 'rgba(255,255,255,0.08)'}`,
            cursor: 'pointer',
          }}
        >
          Todos
        </button>
        {ALL_ORDER_STATUSES.map((s) => {
          const active = status === s
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className="rounded-full px-3 py-1 text-xs"
              style={{
                background: active ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.05)',
                color: active ? '#F4631E' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${active ? 'rgba(244,99,30,0.3)' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer',
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          )
        })}
      </div>

      {/* Cabeçalho */}
      <div className="grid grid-cols-[0.7fr_1.2fr_1.2fr_1fr_1.2fr_1fr_1fr] gap-4 rounded-[8px] px-4 py-2 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}>
        <span>ID</span>
        <span>Criador</span>
        <span>Editor</span>
        <span>Valor</span>
        <span>Status</span>
        <span>Data</span>
        <span className="text-right">Ação</span>
      </div>

      {loading ? (
        <Spinner />
      ) : !data || data.orders.length === 0 ? (
        <EmptyState message="Nenhum pedido encontrado" />
      ) : (
        <div className="mt-1">
          {data.orders.map((o) => {
            const isDisputed = o.status === 'DISPUTED'
            const dispute = disputeByOrderId.get(o.id) ?? null
            return (
              <div
                key={o.id}
                onClick={() => onOpenOrder(o.id)}
                className="grid cursor-pointer grid-cols-[0.7fr_1.2fr_1.2fr_1fr_1.2fr_1fr_1fr] items-center gap-4 border-b px-4 py-3 text-sm transition-colors"
                style={{
                  borderColor: 'rgba(255,255,255,0.05)',
                  background: isDisputed ? 'rgba(244,99,30,0.06)' : 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isDisputed ? 'rgba(244,99,30,0.1)' : 'rgba(255,255,255,0.03)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isDisputed ? 'rgba(244,99,30,0.06)' : 'transparent' }}
              >
                <span className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{shortId(o.id)}</span>
                <span className="truncate text-white">{o.creatorName}</span>
                <span className="truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{o.editorName}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{money(o.budget)}</span>
                <span><OrderStatusBadge status={o.status} /></span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fmtDate(o.createdAt)}</span>
                <div className="flex justify-end">
                  {isDisputed && dispute ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setResolveTarget(dispute) }}
                      className="flex items-center gap-1 rounded-[6px] px-2 py-1 text-[11px] font-semibold"
                      style={{ background: 'rgba(244,99,30,0.15)', border: '1px solid rgba(244,99,30,0.3)', color: '#F4631E', cursor: 'pointer' }}
                    >
                      <IconGavel size={12} stroke={1.5} />
                      Resolver
                    </button>
                  ) : (
                    <IconChevronRight size={15} stroke={1.5} style={{ color: 'rgba(255,255,255,0.25)' }} />
                  )}
                </div>
              </div>
            )
          })}
          <Pagination page={page} totalPages={data.totalPages} onPage={setPage} />
        </div>
      )}

      <ResolveDisputeModal
        dispute={resolveTarget}
        onClose={() => setResolveTarget(null)}
        onResolved={async () => { setResolveTarget(null); await load() }}
      />
    </div>
  )
}

function ResolveDisputeModal({
  dispute,
  onClose,
  onResolved,
}: {
  dispute: AdminDispute | null
  onClose: () => void
  onResolved: () => Promise<void>
}) {
  const [busy, setBusy] = useState<'RELEASE' | 'REFUND' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handle(resolution: 'RELEASE' | 'REFUND') {
    if (!dispute) return
    setBusy(resolution)
    setError(null)
    try {
      await resolveDispute(dispute.order.id, resolution)
      await onResolved()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao resolver disputa')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={dispute !== null}
      onClose={() => (busy ? undefined : onClose())}
      title="Resolver disputa"
      subtitle={dispute ? dispute.order.title : undefined}
      size="md"
      footer={
        <>
          <button
            onClick={() => handle('REFUND')}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: "'Syne', sans-serif" }}
          >
            {busy === 'REFUND' ? <IconLoader2 size={14} className="animate-spin" /> : <IconArrowBackUp size={14} stroke={1.5} />}
            Reembolsar criador
          </button>
          <button
            onClick={() => handle('RELEASE')}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold"
            style={{ background: '#22C55E', color: 'white', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: "'Syne', sans-serif" }}
          >
            {busy === 'RELEASE' ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} stroke={2} />}
            Liberar para editor
          </button>
        </>
      }
    >
      {dispute && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[8px] px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Criador</p>
              <p className="text-sm text-white">{dispute.order.creatorName}</p>
            </div>
            <div className="rounded-[8px] px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Editor</p>
              <p className="text-sm text-white">{dispute.order.editorName}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-[8px] px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Valor em custódia</span>
            <span className="font-heading text-sm font-bold text-white">{money(dispute.order.budget)}</span>
          </div>
          <div className="rounded-[8px] p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="mb-1 flex items-center gap-1.5">
              <IconAlertTriangle size={13} stroke={1.5} style={{ color: '#EF4444' }} />
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#EF4444' }}>Motivo da disputa</p>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{dispute.reason}</p>
          </div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <strong className="text-white">Liberar para editor</strong> conclui o pedido e libera o pagamento retido.{' '}
            <strong className="text-white">Reembolsar criador</strong> cancela o pedido e estorna o valor.
          </p>
          {error && <p className="text-xs" style={{ color: '#FCA5A5' }}>{error}</p>}
        </div>
      )}
    </Modal>
  )
}

function FinanceiroSection() {
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ transactions: AdminTransaction[]; totalPages: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getFinancialSummary().then((s) => { if (alive) setSummary(s) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    listAdminTransactions({ page })
      .then((res) => { if (alive) setData({ transactions: res.transactions, totalPages: res.totalPages }) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page])

  const cards: { label: string; value: number; Icon: React.ElementType; color: string }[] = [
    { label: 'Total transacionado', value: summary?.totalTransacted ?? 0, Icon: IconTrendingUp, color: '#22C55E' },
    { label: 'Taxas da plataforma', value: summary?.totalPlatformFees ?? 0, Icon: IconCreditCard, color: '#F4631E' },
    { label: 'Em custódia (escrow)', value: summary?.totalHeldInEscrow ?? 0, Icon: IconClock, color: '#3B82F6' },
    { label: 'Total reembolsado', value: summary?.totalRefunded ?? 0, Icon: IconArrowBackUp, color: '#EF4444' },
  ]

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-card p-5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${c.color}1A` }}>
                <c.Icon size={16} stroke={1.5} color={c.color} />
              </span>
            </div>
            <p className="font-heading text-2xl font-bold text-white">
              {summary ? money(c.value) : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Tabela de transações */}
      <div className="rounded-card p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <SectionHeader title="Últimas transações" />
        <div className="grid grid-cols-[0.8fr_1.2fr_1.2fr_1fr_1fr_1.3fr_1fr] gap-4 rounded-[8px] px-4 py-2 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}>
          <span>Pedido</span>
          <span>Pagador</span>
          <span>Recebedor</span>
          <span>Valor</span>
          <span>Taxa</span>
          <span>Status</span>
          <span>Data</span>
        </div>

        {loading ? (
          <Spinner />
        ) : !data || data.transactions.length === 0 ? (
          <EmptyState message="Nenhuma transação registrada ainda" />
        ) : (
          <div className="mt-1">
            {data.transactions.map((t) => (
              <div key={t.id} className="grid grid-cols-[0.8fr_1.2fr_1.2fr_1fr_1fr_1.3fr_1fr] items-center gap-4 border-b px-4 py-3 text-sm" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <span className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{shortId(t.orderId)}</span>
                <span className="truncate text-white">{t.payerName}</span>
                <span className="truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{t.payeeName}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)' }}>{money(t.amount)}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{money(t.platformFee)}</span>
                <span><TransactionBadge status={t.status} /></span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fmtDate(t.createdAt)}</span>
              </div>
            ))}
            <Pagination page={page} totalPages={data.totalPages} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}

function SubscriptionsSection() {
  return (
    <div
      className="rounded-card p-6"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <SectionHeader title="Assinaturas Premium" />

      <div
        className="mb-2 grid grid-cols-4 gap-4 rounded-[8px] px-4 py-2 text-xs font-medium"
        style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}
      >
        <span>Editor</span>
        <span>Status</span>
        <span>Início</span>
        <span>Expiração</span>
      </div>

      <EmptyState message="Nenhuma assinatura ativa ainda" />
    </div>
  )
}

// ─── Seções Creator / Editor (placeholder por enquanto) ──────────────────────

function FeedSection({ role }: { role: 'CREATOR' | 'EDITOR' }) {
  const title = role === 'CREATOR' ? 'Feed de Projetos' : 'Feed de Projetos'
  const subtitle =
    role === 'CREATOR'
      ? 'Encontre o editor perfeito para o seu projeto'
      : 'Pedidos disponíveis publicados por criadores'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{subtitle}</p>
        </div>
        {role === 'CREATOR' && (
          <button className="btn-primary" style={{ width: 'auto', padding: '0 20px' }}>
            + Novo Projeto
          </button>
        )}
      </div>

      {/* Filtros por categoria */}
      <div className="flex flex-wrap gap-2">
        {['Todos', 'Reels', 'YouTube', 'TikTok', 'Podcast', 'Corporativo', 'Wedding'].map((cat) => (
          <button
            key={cat}
            className="rounded-full px-3 py-1 text-xs transition-colors"
            style={{
              background: cat === 'Todos' ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.05)',
              color: cat === 'Todos' ? '#F4631E' : 'rgba(255,255,255,0.6)',
              border: `1px solid ${cat === 'Todos' ? 'rgba(244,99,30,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div
        className="rounded-card p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <EmptyState
          message={
            role === 'CREATOR'
              ? 'Editores disponíveis aparecerão aqui'
              : 'Projetos abertos aparecerão aqui'
          }
        />
      </div>
    </div>
  )
}

function MyProjectsSection({ role }: { role: 'CREATOR' | 'EDITOR' }) {
  if (role === 'CREATOR') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-xl font-bold text-white">Meus Projetos</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Acompanhe o status dos seus pedidos de edição
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {['Todos', 'Pendentes', 'Em andamento', 'Em revisão', 'Concluídos'].map((f) => (
            <button
              key={f}
              className="rounded-full px-3 py-1 text-xs"
              style={{
                background: f === 'Todos' ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.05)',
                color: f === 'Todos' ? '#F4631E' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${f === 'Todos' ? 'rgba(244,99,30,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <div
          className="rounded-card p-6"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <EmptyState message="Seus pedidos aparecerão aqui" />
        </div>
      </div>
    )
  }

  // EDITOR
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-white">Meus Projetos</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Pedidos aceitos, portfólio e métricas
          </p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '0 20px' }}>
          + Adicionar ao Portfólio
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pedidos Ativos', value: '0', icon: IconClock },
          { label: 'Concluídos', value: '0', icon: IconCheck },
          { label: 'Avaliação Média', value: '—', icon: IconTrendingUp },
        ].map((s) => (
          <StatsCard key={s.label} label={s.label} value={s.value} delta="" Icon={s.icon} />
        ))}
      </div>

      <div
        className="rounded-card p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <SectionHeader title="Pedidos Recebidos" />
        <EmptyState message="Pedidos de criadores aparecerão aqui" />
      </div>

      <div
        className="rounded-card p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <SectionHeader title="Meu Portfólio" />
        <EmptyState message="Adicione projetos ao seu portfólio" />
      </div>
    </div>
  )
}

function AccountSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold text-white">Conta</h2>
        <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Configurações da sua conta e perfil
        </p>
      </div>

      <div
        className="rounded-card p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <SectionHeader title="Em construção" />
        <EmptyState message="Configurações de conta em breve" />
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: AdminSection; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconLayoutDashboard },
  { id: 'users', label: 'Usuários', Icon: IconUsers },
  { id: 'orders', label: 'Ordens', Icon: IconBriefcase },
  { id: 'transactions', label: 'Financeiro', Icon: IconCreditCard },
  { id: 'subscriptions', label: 'Assinaturas', Icon: IconCrown },
]

const USER_NAV_ITEMS: { id: UserSection; label: string; Icon: React.ElementType }[] = [
  { id: 'feed', label: 'Feed de Projetos', Icon: IconRss },
  { id: 'projects', label: 'Meus Projetos', Icon: IconFolder },
  { id: 'account', label: 'Conta', Icon: IconUserCircle },
]

// ─── Página principal ─────────────────────────────────────────────────────────

export function AdminPage() {
  const navigate = useNavigate()
  const [section, setSection] = useState<AdminSection>('dashboard')
  const [userSection, setUserSection] = useState<UserSection>('feed')
  const [viewMode, setViewMode] = useState<ViewMode>('ADMIN')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  function enterViewMode(mode: 'CREATOR' | 'EDITOR') {
    setViewMode(mode)
    setUserSection('feed')
    setProfileMenuOpen(false)
  }

  const storedUser = localStorage.getItem('user')
  const user = storedUser ? JSON.parse(storedUser) : { name: 'Admin' }

  useEffect(() => {
    if (!profileMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [profileMenuOpen])

  function handleLogout() {
    localStorage.clear()
    navigate('/login')
  }

  const sectionTitles: Record<AdminSection, string> = {
    dashboard: 'Dashboard',
    users: 'Usuários',
    orders: 'Ordens',
    transactions: 'Financeiro',
    subscriptions: 'Assinaturas',
  }

  function handleViewUser(u: AdminUser) {
    // Apenas editores têm perfil público
    if (u.role === 'EDITOR' || u.role === 'BOTH') navigate(`/editors/${u.id}`)
  }

  const userSectionTitles: Record<UserSection, string> = {
    feed: 'Feed de Projetos',
    projects: 'Meus Projetos',
    account: 'Conta',
  }

  const sidebarBadge =
    viewMode === 'ADMIN' ? 'ADMIN' : viewMode === 'CREATOR' ? 'CREATOR' : 'EDITOR'

  const topbarTitle =
    viewMode === 'ADMIN' ? sectionTitles[section] : userSectionTitles[userSection]

  const topbarSubtitle =
    viewMode === 'ADMIN'
      ? 'Painel de administração'
      : `Visualização de ${viewMode === 'CREATOR' ? 'creator' : 'editor'}`

  return (
    <div className="flex min-h-screen" style={{ background: '#0D1B2A' }}>
      {/* ── Toast flutuante de modo de visualização ── */}
      {viewMode !== 'ADMIN' && (
        <div
          className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 shadow-lg"
          style={{
            background: 'rgba(244,99,30,0.15)',
            border: '1px solid rgba(244,99,30,0.35)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {viewMode === 'CREATOR'
            ? <IconCamera size={14} color="#F4631E" stroke={1.5} />
            : <IconMovie size={14} color="#F4631E" stroke={1.5} />}
          <span className="text-xs" style={{ color: '#F4631E' }}>
            Visualizando como <strong>{viewMode === 'CREATOR' ? 'Creator' : 'Editor'}</strong>
          </span>
          <button
            onClick={() => setViewMode('ADMIN')}
            aria-label="Sair do modo de visualização"
            className="flex h-5 w-5 items-center justify-center rounded-full transition-colors"
            style={{
              background: 'rgba(244,99,30,0.2)',
              border: 'none',
              cursor: 'pointer',
              color: '#F4631E',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,99,30,0.35)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(244,99,30,0.2)' }}
          >
            <IconX size={12} stroke={2} />
          </button>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside
        className="flex w-64 shrink-0 flex-col"
        style={{
          background: '#162436',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          height: '100vh',
          position: 'sticky',
          top: 0,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="h-2 w-2 rounded-full" style={{ background: '#F4631E' }} />
          <span className="font-heading text-[18px] font-extrabold text-white">CutMakers</span>
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: 'rgba(244,99,30,0.15)', color: '#F4631E', fontFamily: "'Syne', sans-serif" }}
          >
            {sidebarBadge}
          </span>
        </div>

        {/* Nav principal */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {viewMode === 'ADMIN' ? 'Gerenciamento' : 'Navegação'}
          </p>

          {viewMode === 'ADMIN'
            ? NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = section === id
                return (
                  <button
                    key={id}
                    onClick={() => setSection(id)}
                    className="mb-1 flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm transition-colors"
                    style={{
                      background: active ? 'rgba(244,99,30,0.12)' : 'transparent',
                      color: active ? '#F4631E' : 'rgba(255,255,255,0.6)',
                      border: active ? '1px solid rgba(244,99,30,0.2)' : '1px solid transparent',
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: active ? 500 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Icon size={16} stroke={1.5} />
                    {label}
                  </button>
                )
              })
            : USER_NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = userSection === id
                return (
                  <button
                    key={id}
                    onClick={() => setUserSection(id)}
                    className="mb-1 flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm transition-colors"
                    style={{
                      background: active ? 'rgba(244,99,30,0.12)' : 'transparent',
                      color: active ? '#F4631E' : 'rgba(255,255,255,0.6)',
                      border: active ? '1px solid rgba(244,99,30,0.2)' : '1px solid transparent',
                      fontFamily: "'DM Sans', sans-serif",
                      fontWeight: active ? 500 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Icon size={16} stroke={1.5} />
                    {label}
                  </button>
                )
              })}
        </nav>

        {/* Footer: usuário + logout */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="mb-2 flex items-center gap-3 rounded-[8px] px-3 py-2">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-heading text-xs font-bold text-white"
              style={{ background: '#F4631E' }}
            >
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {viewMode === 'ADMIN'
                  ? 'Administrador'
                  : viewMode === 'CREATOR'
                  ? 'Vendo como Creator'
                  : 'Vendo como Editor'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm transition-colors"
            style={{
              color: 'rgba(255,255,255,0.4)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'none' }}
          >
            <IconLogout size={16} stroke={1.5} />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Conteúdo principal ── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <h1 className="font-heading text-lg font-bold text-white">{topbarTitle}</h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{topbarSubtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
            >
              <IconBell size={16} stroke={1.5} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </button>
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full font-heading text-sm font-bold text-white transition-transform"
                style={{ background: '#F4631E', border: 'none', cursor: 'pointer' }}
              >
                {user.name?.charAt(0).toUpperCase()}
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-[12px] shadow-xl"
                  style={{
                    background: '#162436',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    className="px-4 py-3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <p className="truncate text-sm font-medium text-white">{user.name}</p>
                    <p
                      className="text-[10px] uppercase tracking-widest"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                    >
                      Administrador
                    </p>
                  </div>

                  <button
                    role="menuitem"
                    onClick={() => enterViewMode('CREATOR')}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={{
                      background: viewMode === 'CREATOR' ? 'rgba(244,99,30,0.1)' : 'transparent',
                      color: viewMode === 'CREATOR' ? '#F4631E' : 'rgba(255,255,255,0.8)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (viewMode !== 'CREATOR') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    }}
                    onMouseLeave={(e) => {
                      if (viewMode !== 'CREATOR') e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <IconCamera size={16} stroke={1.5} />
                    Visualizar como Creator
                  </button>

                  <button
                    role="menuitem"
                    onClick={() => enterViewMode('EDITOR')}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                    style={{
                      background: viewMode === 'EDITOR' ? 'rgba(244,99,30,0.1)' : 'transparent',
                      color: viewMode === 'EDITOR' ? '#F4631E' : 'rgba(255,255,255,0.8)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif",
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (viewMode !== 'EDITOR') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    }}
                    onMouseLeave={(e) => {
                      if (viewMode !== 'EDITOR') e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <IconMovie size={16} stroke={1.5} />
                    Visualizar como Editor
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Área de conteúdo */}
        <main className="flex-1 overflow-y-auto p-6">
          {viewMode === 'ADMIN' && (
            <>
              {section === 'dashboard' && <DashboardSection />}
              {section === 'users' && <UsersSection onViewUser={handleViewUser} />}
              {section === 'orders' && <OrdersSection onOpenOrder={(id) => navigate(`/orders/${id}`)} />}
              {section === 'transactions' && <FinanceiroSection />}
              {section === 'subscriptions' && <SubscriptionsSection />}
            </>
          )}
          {viewMode !== 'ADMIN' && (
            <>
              {userSection === 'feed' && <FeedSection role={viewMode} />}
              {userSection === 'projects' && <MyProjectsSection role={viewMode} />}
              {userSection === 'account' && <AccountSection />}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
