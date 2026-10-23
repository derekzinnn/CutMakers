import { useCached } from '@/hooks/use-cached'
import { formatMoney as money } from '@/lib/format'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconLayoutDashboard,
  IconUsers,
  IconBriefcase,
  IconCreditCard,
  IconCrown,
  IconCamera,
  IconMovie,
  IconTrendingUp,
  IconCheck,
  IconClock,
  IconDots,
  IconSearch,
  IconChevronRight,
  IconChevronLeft,
  IconLoader2,
  IconBan,
  IconArrowBackUp,
  IconEye,
  IconGavel,
  IconAlertTriangle,
  IconRosetteDiscountCheck,
  IconHistory,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react'
import { Modal } from '@/components/ui/Modal'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { useAuth } from '@/hooks/use-auth'
import { STATUS_LABELS, STATUS_COLORS, TRANSACTION_LABELS, type OrderStatus, type TransactionStatus } from '@/lib/orders'
import { resolveDispute } from '@/lib/disputes'
import {
  listUsers,
  banUser,
  unbanUser,
  verifyEditor,
  unverifyEditor,
  listAdminOrders,
  listAdminDisputes,
  getFinancialSummary,
  listAdminTransactions,
  listAuditLog,
  type AdminUser,
  type AdminOrder,
  type AdminDispute,
  type AdminTransaction,
  type FinancialSummary,
  type UserRole,
  type AuditLogEntry,
} from '@/lib/admin'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type AdminSection = 'dashboard' | 'users' | 'orders' | 'transactions' | 'subscriptions' | 'audit'

// ─── Helpers compartilhados ───────────────────────────────────────────────────

const shortId = (id: string) => id.slice(0, 8)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

const ROLE_LABELS: Record<UserRole, string> = {
  CREATOR: 'Creator',
  EDITOR: 'Editor',
  BOTH: 'Ambos',
  ADMIN: 'Admin',
}

const TRANSACTION_COLORS: Record<TransactionStatus, string> = {
  PENDING: 'var(--brand)',
  HELD: 'var(--info)',
  RELEASED: 'var(--success)',
  REFUNDED: 'var(--destructive)',
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

// Spinner removido: todas as telas passaram a usar skeleton com a FORMA do
// conteudo, entao a rodinha generica nao e mais usada em lugar nenhum.

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  const navBtn = (disabled: boolean, onClick: () => void, icon: React.ReactNode) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-[8px]"
      style={{
        background: 'var(--surface-subtle)',
        border: '1px solid var(--border)',
        color: disabled ? 'var(--muted-foreground)' : 'var(--foreground)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {icon}
    </button>
  )
  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
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
      style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: 'var(--brand-soft)' }}
        >
          <Icon size={16} stroke={1.5} color="var(--brand)" />
        </span>
      </div>
      <p className="font-heading text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
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
        style={{ background: 'var(--surface-subtle)' }}
      >
        <IconDots size={24} stroke={1.5} style={{ color: 'var(--muted-foreground)' }} />
      </div>
      <p className="text-sm font-medium text-white">Nenhum dado ainda</p>
      <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
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
        style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
      >
        <SectionHeader
          title="Últimos Usuários"
          action={
            <button
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer' }}
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
        style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
      >
        <SectionHeader
          title="Últimos Pedidos"
          action={
            <button
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer' }}
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
  const [target, setTarget] = useState<AdminUser | null>(null)
  const [verifyBusy, setVerifyBusy] = useState<string | null>(null)

  async function onToggleVerify(u: AdminUser) {
    setVerifyBusy(u.id)
    try {
      if (u.verified) await unverifyEditor(u.id)
      else await verifyEditor(u.id)
      await load()
    } finally {
      setVerifyBusy(null)
    }
  }
  const [busy, setBusy] = useState(false)

  // Chave inclui os filtros: voltar para uma combinacao ja vista e instantaneo,
  // e trocar de aba e voltar nao refaz a busca dentro do TTL.
  const { dado: data, carregando: loading, recarregar: load } = useCached<{
    users: AdminUser[]
    totalPages: number
  }>(`admin-users:${search}:${role}:${page}`, async () => {
    const res = await listUsers({
      search: search || undefined,
      role: role === 'ALL' ? undefined : role,
      page,
    })
    return { users: res.users, totalPages: res.totalPages }
  })

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
    <div className="rounded-card p-6" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
      {/* Busca + filtro de role */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
          <IconSearch size={14} stroke={1.5} style={{ color: 'var(--muted-foreground)' }} />
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
                  background: active ? 'var(--brand-soft)' : 'var(--surface-subtle)',
                  color: active ? 'var(--brand)' : 'var(--foreground)',
                  border: `1px solid ${active ? 'var(--brand-border)' : 'var(--border)'}`,
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
      <div className="grid grid-cols-[1.4fr_1.8fr_0.8fr_1fr_0.9fr_1.2fr] gap-4 rounded-[8px] px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)', background: 'var(--surface-subtle)' }}>
        <span>Nome</span>
        <span>Email</span>
        <span>Role</span>
        <span>Cadastro</span>
        <span>Status</span>
        <span className="text-right">Ações</span>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={6} gridClass="grid grid-cols-[1.4fr_1.8fr_0.8fr_1fr_0.9fr_1.2fr] items-center gap-4 px-4 py-3" />
      ) : !data || data.users.length === 0 ? (
        <EmptyState message="Nenhum usuário encontrado" />
      ) : (
        <div className="mt-1">
          {data.users.map((u) => (
            <div key={u.id} className="grid grid-cols-[1.4fr_1.8fr_0.8fr_1fr_0.9fr_1.2fr] items-center gap-4 border-b px-4 py-3 text-sm" style={{ borderColor: 'var(--surface-subtle)' }}>
              <span className="flex items-center gap-2 truncate text-white">
                {u.name}
                {u.isPremium && <IconRosetteDiscountCheck size={14} stroke={2} style={{ color: 'var(--brand)', flexShrink: 0 }} />}
              </span>
              <span className="truncate" style={{ color: 'var(--foreground)' }}>{u.email}</span>
              <span style={{ color: 'var(--foreground)' }}>{ROLE_LABELS[u.role]}</span>
              <span style={{ color: 'var(--muted-foreground)' }}>{fmtDate(u.createdAt)}</span>
              <span>
                {u.banned ? (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--destructive-soft)', color: 'var(--destructive)' }}>Suspenso</span>
                ) : (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>Ativo</span>
                )}
              </span>
              <div className="flex items-center justify-end gap-2">
                {(u.role === 'EDITOR' || u.role === 'BOTH') && (
                  <button
                    onClick={() => onViewUser(u)}
                    title="Ver perfil"
                    className="flex h-7 w-7 items-center justify-center rounded-[6px]"
                    style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}
                  >
                    <IconEye size={14} stroke={1.5} />
                  </button>
                )}
                {(u.role === 'EDITOR' || u.role === 'BOTH') && (
                  <button
                    onClick={() => onToggleVerify(u)}
                    disabled={verifyBusy === u.id}
                    title={u.verified ? 'Remover selo verificado' : 'Verificar editor'}
                    className="flex h-7 items-center gap-1 rounded-[6px] px-2 text-[11px] font-medium"
                    style={{
                      background: u.verified ? 'var(--brand-soft)' : 'var(--surface-subtle)',
                      border: `1px solid ${u.verified ? 'var(--brand-border)' : 'var(--border)'}`,
                      color: u.verified ? 'var(--brand)' : 'var(--muted-foreground)',
                      cursor: verifyBusy === u.id ? 'wait' : 'pointer',
                      opacity: verifyBusy === u.id ? 0.6 : 1,
                    }}
                  >
                    <IconRosetteDiscountCheck size={13} stroke={1.8} />
                    {u.verified ? 'Verificado' : 'Verificar'}
                  </button>
                )}
                {u.role !== 'ADMIN' && (
                  <button
                    onClick={() => setTarget(u)}
                    title={u.banned ? 'Desbanir' : 'Banir'}
                    className="flex h-7 items-center gap-1 rounded-[6px] px-2 text-[11px] font-medium"
                    style={{
                      background: u.banned ? 'var(--success-soft)' : 'var(--destructive-soft)',
                      border: `1px solid ${u.banned ? 'var(--success-border)' : 'var(--destructive-border)'}`,
                      color: u.banned ? 'var(--success)' : 'var(--destructive)',
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
              style={{ background: 'transparent', color: 'var(--muted-foreground)', border: '1px solid var(--border)', cursor: busy ? 'not-allowed' : 'pointer' }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmBanToggle}
              disabled={busy}
              className="flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold"
              style={{
                background: target?.banned ? 'var(--success)' : 'var(--destructive)',
                color: 'white', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
                fontFamily: "var(--font-heading)",
              }}
            >
              {busy && <IconLoader2 size={14} className="animate-spin" />}
              {target?.banned ? 'Desbanir' : 'Suspender conta'}
            </button>
          </>
        }
      >
        <p className="text-sm" style={{ color: 'var(--foreground)' }}>
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
  const [resolveTarget, setResolveTarget] = useState<AdminDispute | null>(null)

  const { dado: pagina, carregando: loading, recarregar: load } = useCached<{
    orders: AdminOrder[]
    totalPages: number
    disputes: AdminDispute[]
  }>(`admin-orders:${status}:${page}`, async () => {
    const [res, disp] = await Promise.all([
      listAdminOrders({ status: status === 'ALL' ? undefined : status, page }),
      listAdminDisputes(),
    ])
    return { orders: res.orders, totalPages: res.totalPages, disputes: disp }
  })
  const data = pagina
  const disputes = pagina?.disputes ?? []
  useEffect(() => { setPage(1) }, [status])

  const disputeByOrderId = new Map(disputes.map((d) => [d.order.id, d]))

  return (
    <div className="rounded-card p-6" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
      {/* Filtro de status */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setStatus('ALL')}
          className="rounded-full px-3 py-1 text-xs"
          style={{
            background: status === 'ALL' ? 'var(--brand-soft)' : 'var(--surface-subtle)',
            color: status === 'ALL' ? 'var(--brand)' : 'var(--foreground)',
            border: `1px solid ${status === 'ALL' ? 'var(--brand-border)' : 'var(--border)'}`,
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
                background: active ? 'var(--brand-soft)' : 'var(--surface-subtle)',
                color: active ? 'var(--brand)' : 'var(--foreground)',
                border: `1px solid ${active ? 'var(--brand-border)' : 'var(--border)'}`,
                cursor: 'pointer',
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          )
        })}
      </div>

      {/* Cabeçalho */}
      <div className="grid grid-cols-[0.7fr_1.2fr_1.2fr_1fr_1.2fr_1fr_1fr] gap-4 rounded-[8px] px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)', background: 'var(--surface-subtle)' }}>
        <span>ID</span>
        <span>Criador</span>
        <span>Editor</span>
        <span>Valor</span>
        <span>Status</span>
        <span>Data</span>
        <span className="text-right">Ação</span>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={7} gridClass="grid grid-cols-[0.7fr_1.2fr_1.2fr_1fr_1.2fr_1fr_1fr] items-center gap-4 px-4 py-3" />
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
                  borderColor: 'var(--surface-subtle)',
                  background: isDisputed ? 'var(--brand-soft)' : 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = isDisputed ? 'var(--brand-soft)' : 'var(--surface-subtle)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = isDisputed ? 'var(--brand-soft)' : 'transparent' }}
              >
                <span className="font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{shortId(o.id)}</span>
                <span className="truncate text-white">{o.creatorName}</span>
                <span className="truncate" style={{ color: 'var(--foreground)' }}>{o.editorName}</span>
                <span style={{ color: 'var(--foreground)' }}>{money(o.budget)}</span>
                <span><OrderStatusBadge status={o.status} /></span>
                <span style={{ color: 'var(--muted-foreground)' }}>{fmtDate(o.createdAt)}</span>
                <div className="flex justify-end">
                  {isDisputed && dispute ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setResolveTarget(dispute) }}
                      className="flex items-center gap-1 rounded-[6px] px-2 py-1 text-[11px] font-semibold"
                      style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)', color: 'var(--brand)', cursor: 'pointer' }}
                    >
                      <IconGavel size={12} stroke={1.5} />
                      Resolver
                    </button>
                  ) : (
                    <IconChevronRight size={15} stroke={1.5} style={{ color: 'var(--muted-foreground)' }} />
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
            style={{ background: 'var(--destructive-soft)', color: 'var(--destructive)', border: '1px solid var(--destructive-border)', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: "var(--font-heading)" }}
          >
            {busy === 'REFUND' ? <IconLoader2 size={14} className="animate-spin" /> : <IconArrowBackUp size={14} stroke={1.5} />}
            Reembolsar criador
          </button>
          <button
            onClick={() => handle('RELEASE')}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--success)', color: 'white', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: "var(--font-heading)" }}
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
            <div className="rounded-[8px] px-3 py-2" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>Criador</p>
              <p className="text-sm text-white">{dispute.order.creatorName}</p>
            </div>
            <div className="rounded-[8px] px-3 py-2" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>Editor</p>
              <p className="text-sm text-white">{dispute.order.editorName}</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-[8px] px-3 py-2" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Valor em custódia</span>
            <span className="font-heading text-sm font-bold text-white">{money(dispute.order.budget)}</span>
          </div>
          <div className="rounded-[8px] p-3" style={{ background: 'var(--destructive-soft)', border: '1px solid var(--destructive-border)' }}>
            <div className="mb-1 flex items-center gap-1.5">
              <IconAlertTriangle size={13} stroke={1.5} style={{ color: 'var(--destructive)' }} />
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--destructive)' }}>Motivo da disputa</p>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{dispute.reason}</p>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <strong className="text-white">Liberar para editor</strong> conclui o pedido e libera o pagamento retido.{' '}
            <strong className="text-white">Reembolsar criador</strong> cancela o pedido e estorna o valor.
          </p>
          {error && <p className="text-xs" style={{ color: 'var(--destructive)' }}>{error}</p>}
        </div>
      )}
    </Modal>
  )
}

function FinanceiroSection() {
  const [page, setPage] = useState(1)
  const { dado: summary } = useCached<FinancialSummary>(
    'admin-financial-summary',
    () => getFinancialSummary(),
  )
  const { dado: data, carregando: loading } = useCached<{
    transactions: AdminTransaction[]
    totalPages: number
  }>(`admin-transactions:${page}`, async () => {
    const res = await listAdminTransactions({ page })
    return { transactions: res.transactions, totalPages: res.totalPages }
  })

  const cards: { label: string; value: number; Icon: React.ElementType; color: string }[] = [
    { label: 'Total transacionado', value: summary?.totalTransacted ?? 0, Icon: IconTrendingUp, color: 'var(--success)' },
    { label: 'Taxas da plataforma', value: summary?.totalPlatformFees ?? 0, Icon: IconCreditCard, color: 'var(--brand)' },
    { label: 'Em custódia (escrow)', value: summary?.totalHeldInEscrow ?? 0, Icon: IconClock, color: 'var(--info)' },
    { label: 'Total reembolsado', value: summary?.totalRefunded ?? 0, Icon: IconArrowBackUp, color: 'var(--destructive)' },
  ]

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-card p-5" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{c.label}</span>
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
      <div className="rounded-card p-6" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
        <SectionHeader title="Últimas transações" />
        <div className="grid grid-cols-[0.8fr_1.2fr_1.2fr_1fr_1fr_1.3fr_1fr] gap-4 rounded-[8px] px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)', background: 'var(--surface-subtle)' }}>
          <span>Pedido</span>
          <span>Pagador</span>
          <span>Recebedor</span>
          <span>Valor</span>
          <span>Taxa</span>
          <span>Status</span>
          <span>Data</span>
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={7} gridClass="grid grid-cols-[0.8fr_1.2fr_1.2fr_1fr_1fr_1.3fr_1fr] items-center gap-4 px-4 py-3" />
        ) : !data || data.transactions.length === 0 ? (
          <EmptyState message="Nenhuma transação registrada ainda" />
        ) : (
          <div className="mt-1">
            {data.transactions.map((t) => (
              <div key={t.id} className="grid grid-cols-[0.8fr_1.2fr_1.2fr_1fr_1fr_1.3fr_1fr] items-center gap-4 border-b px-4 py-3 text-sm" style={{ borderColor: 'var(--surface-subtle)' }}>
                <span className="font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>{shortId(t.orderId)}</span>
                <span className="truncate text-white">{t.payerName}</span>
                <span className="truncate" style={{ color: 'var(--foreground)' }}>{t.payeeName}</span>
                <span style={{ color: 'var(--foreground)' }}>{money(t.amount)}</span>
                <span style={{ color: 'var(--muted-foreground)' }}>{money(t.platformFee)}</span>
                <span><TransactionBadge status={t.status} /></span>
                <span style={{ color: 'var(--muted-foreground)' }}>{fmtDate(t.createdAt)}</span>
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
      style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
    >
      <SectionHeader title="Assinaturas Premium" />

      <div
        className="mb-2 grid grid-cols-4 gap-4 rounded-[8px] px-4 py-2 text-xs font-medium"
        style={{ color: 'var(--muted-foreground)', background: 'var(--surface-subtle)' }}
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

// ─── Auditoria ────────────────────────────────────────────────────────────────

const AUDIT_ACTIONS: Record<string, { label: string; color: string }> = {
  ORDER_CREATED: { label: 'Pedido criado', color: 'var(--info)' },
  ORDER_CANCELLED: { label: 'Pedido cancelado', color: 'var(--destructive)' },
  PROPOSAL_ACCEPTED: { label: 'Proposta aceita', color: 'var(--info)' },
  PAYMENT_INITIATED: { label: 'Pagamento iniciado', color: 'var(--brand)' },
  PAYMENT_CONFIRMED: { label: 'Pagamento confirmado', color: 'var(--success)' },
  PAYMENT_RELEASED: { label: 'Pagamento liberado', color: 'var(--success)' },
  PAYMENT_REFUNDED: { label: 'Pagamento reembolsado', color: 'var(--destructive)' },
  REVISION_REQUESTED: { label: 'Revisão solicitada', color: '#EAB308' },
  DISPUTE_OPENED: { label: 'Disputa aberta', color: 'var(--brand)' },
  DISPUTE_RESOLVED: { label: 'Disputa resolvida', color: 'var(--brand)' },
  SUBSCRIPTION_ACTIVATED: { label: 'Assinatura ativada', color: '#A855F7' },
  USER_BANNED: { label: 'Usuário suspenso', color: 'var(--destructive)' },
  USER_UNBANNED: { label: 'Usuário reativado', color: 'var(--success)' },
  PASSWORD_CHANGED: { label: 'Senha alterada', color: 'var(--warning)' },
  REQUEST_CREATED: { label: 'Solicitação publicada', color: 'var(--info)' },
  REQUEST_CANCELLED: { label: 'Solicitação cancelada', color: 'var(--destructive)' },
  REQUEST_PROPOSAL_SENT: { label: 'Proposta enviada (solicitação)', color: '#EAB308' },
  REQUEST_PROPOSAL_ACCEPTED: { label: 'Proposta aceita (solicitação)', color: 'var(--success)' },
}

const ENTITY_LABELS: Record<string, string> = {
  Order: 'Pedido',
  Transaction: 'Transação',
  Dispute: 'Disputa',
  Subscription: 'Assinatura',
  User: 'Usuário',
  ProjectRequest: 'Solicitação',
  RequestProposal: 'Proposta',
}

/** Converte o metadata JSON em pares legíveis (Valor: R$ 200,00 etc.) */
function formatAuditMetadata(metadata: Record<string, unknown> | null): { label: string; value: string }[] {
  if (!metadata) return []
  const out: { label: string; value: string }[] = []
  const asMoney = (v: unknown) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue
    switch (key) {
      case 'amount': out.push({ label: 'Valor', value: asMoney(value) }); break
      case 'netAmount': out.push({ label: 'Líquido ao editor', value: asMoney(value) }); break
      case 'platformFee': out.push({ label: 'Taxa da plataforma', value: asMoney(value) }); break
      case 'orderId': out.push({ label: 'Pedido', value: shortId(String(value)) }); break
      case 'reason': out.push({ label: 'Motivo', value: String(value) }); break
      case 'resolution':
        out.push({ label: 'Resolução', value: value === 'RELEASE' ? 'Liberado ao editor' : 'Reembolsado ao criador' })
        break
      case 'deliveryVersion': out.push({ label: 'Entrega', value: `v${String(value)}` }); break
      case 'externalPaymentId': out.push({ label: 'ID externo (gateway)', value: String(value) }); break
      case 'expiresAt': out.push({ label: 'Válida até', value: new Date(String(value)).toLocaleDateString('pt-BR') }); break
      case 'devMode': out.push({ label: 'Origem', value: 'Confirmação automática (dev)' }); break
      case 'requestId': out.push({ label: 'Solicitação', value: shortId(String(value)) }); break
      case 'deliveryDays': out.push({ label: 'Prazo proposto', value: `${String(value)} dias` }); break
      case 'budgetMin': out.push({ label: 'Orçamento mín.', value: asMoney(value) }); break
      case 'budgetMax': out.push({ label: 'Orçamento máx.', value: asMoney(value) }); break
      case 'rejectedProposals': out.push({ label: 'Propostas encerradas', value: String(value) }); break
      case 'categoryId': break
      default: out.push({ label: key, value: String(value) })
    }
  }
  return out
}

function AuditSection() {
  const [rawSearch, setRawSearch] = useState('')
  const actorSearch = useDebounced(rawSearch)
  const [action, setAction] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { dado: data, carregando: loading } = useCached<{
    logs: AuditLogEntry[]
    totalPages: number
  }>(`admin-audit:${action}:${actorSearch}:${page}`, async () => {
    const res = await listAuditLog({
      action: action === 'ALL' ? undefined : action,
      actorSearch: actorSearch || undefined,
      page,
    })
    return { logs: res.logs, totalPages: res.totalPages }
  })

  useEffect(() => { setPage(1) }, [action, actorSearch])

  return (
    <div className="rounded-card p-6" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
      {/* Filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
          <IconSearch size={14} stroke={1.5} style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder="Buscar por usuário (nome/email)..."
            className="w-60 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
          />
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-[8px] px-3 py-2 text-xs outline-none"
          style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', color: 'var(--foreground)', colorScheme: 'dark' }}
        >
          <option value="ALL" style={{ background: 'var(--card)' }}>Todas as ações</option>
          {Object.entries(AUDIT_ACTIONS).map(([value, { label }]) => (
            <option key={value} value={value} style={{ background: 'var(--card)' }}>{label}</option>
          ))}
        </select>
      </div>

      {/* Cabeçalho */}
      <div className="grid grid-cols-[1.1fr_1.4fr_1.5fr_1fr_0.5fr] gap-4 rounded-[8px] px-4 py-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)', background: 'var(--surface-subtle)' }}>
        <span>Data/hora</span>
        <span>Ator</span>
        <span>Ação</span>
        <span>Entidade</span>
        <span className="text-right">Detalhes</span>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={5} gridClass="grid grid-cols-[1.1fr_1.4fr_1.5fr_1fr_0.5fr] items-center gap-4 px-4 py-3" />
      ) : !data || data.logs.length === 0 ? (
        <EmptyState message="Nenhum evento registrado ainda" />
      ) : (
        <div className="mt-1">
          {data.logs.map((log) => {
            const cfg = AUDIT_ACTIONS[log.action] ?? { label: log.action, color: 'var(--muted-foreground)' }
            const details = formatAuditMetadata(log.metadata)
            const expanded = expandedId === log.id
            const hasDetails = details.length > 0
            return (
              <div key={log.id} style={{ borderBottom: '1px solid var(--surface-subtle)' }}>
                <div
                  onClick={() => hasDetails && setExpandedId(expanded ? null : log.id)}
                  className="grid grid-cols-[1.1fr_1.4fr_1.5fr_1fr_0.5fr] items-center gap-4 px-4 py-3 text-sm"
                  style={{ cursor: hasDetails ? 'pointer' : 'default', background: expanded ? 'var(--surface-subtle)' : 'transparent' }}
                >
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {new Date(log.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="truncate">
                    {log.actor ? (
                      <span className="text-white">{log.actor.name}</span>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}>
                        Sistema
                      </span>
                    )}
                  </span>
                  <span>
                    <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: `${cfg.color}1A`, color: cfg.color, border: `1px solid ${cfg.color}33` }}>
                      {cfg.label}
                    </span>
                  </span>
                  <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    {ENTITY_LABELS[log.entityType] ?? log.entityType}
                    <span className="ml-1.5 font-mono text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{shortId(log.entityId)}</span>
                  </span>
                  <span className="flex justify-end">
                    {hasDetails && (
                      expanded
                        ? <IconChevronUp size={14} stroke={1.5} style={{ color: 'var(--muted-foreground)' }} />
                        : <IconChevronDown size={14} stroke={1.5} style={{ color: 'var(--muted-foreground)' }} />
                    )}
                  </span>
                </div>

                {expanded && hasDetails && (
                  <div className="mx-4 mb-3 rounded-[8px] px-4 py-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {details.map((d) => (
                        <div key={d.label} className="flex items-baseline gap-2 text-xs">
                          <span style={{ color: 'var(--muted-foreground)' }}>{d.label}:</span>
                          <span className="truncate text-white">{d.value}</span>
                        </div>
                      ))}
                      {log.actor && (
                        <div className="flex items-baseline gap-2 text-xs">
                          <span style={{ color: 'var(--muted-foreground)' }}>Email do ator:</span>
                          <span className="truncate text-white">{log.actor.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <Pagination page={page} totalPages={data.totalPages} onPage={setPage} />
        </div>
      )}
    </div>
  )
}

// ─── Seções Creator / Editor (placeholder por enquanto) ──────────────────────

// REMOVIDO: FeedSection, MyProjectsSection e AccountSection.
//
// Eram mockups renderizados quando o admin escolhia "Visualizar como
// Creator/Editor" no popover: dados inventados e um card "Em construcao".
// Nao mostravam editor disponivel nenhum nem pedido real, mas PARECIAM a
// visao do usuario — mesma armadilha dos zeros falsos no dashboard do editor.
//
// O popover agora navega para /dashboard/creator e /dashboard/editor, que sao
// as telas de verdade. A conta admin tambem e conta de editor e de criador
// (EDITOR_ROLES / CREATOR_ROLES no backend), entao elas carregam dados reais.

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: AdminSection; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconLayoutDashboard },
  { id: 'users', label: 'Usuários', Icon: IconUsers },
  { id: 'orders', label: 'Ordens', Icon: IconBriefcase },
  { id: 'transactions', label: 'Financeiro', Icon: IconCreditCard },
  { id: 'subscriptions', label: 'Assinaturas', Icon: IconCrown },
  { id: 'audit', label: 'Auditoria', Icon: IconHistory },
]

// ─── Página principal ─────────────────────────────────────────────────────────

export function AdminPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [section, setSection] = useState<AdminSection>('dashboard')

  const sectionTitles: Record<AdminSection, string> = {
    dashboard: 'Dashboard',
    users: 'Usuários',
    orders: 'Ordens',
    transactions: 'Financeiro',
    subscriptions: 'Assinaturas',
    audit: 'Auditoria',
  }

  function handleViewUser(u: AdminUser) {
    // Apenas editores têm perfil público
    if (u.role === 'EDITOR' || u.role === 'BOTH') navigate(`/editors/${u.id}`)
  }

  if (!user) return null

  // A conta admin também é conta de criador e de editor (EDITOR_ROLES / CREATOR_ROLES no
  // backend): os atalhos levam aos dashboards REAIS, com dados de verdade.
  const switchBtn = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8,
    fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)',
    background: 'var(--surface-subtle)', color: 'var(--foreground)', border: '1px solid var(--border)',
  } as const

  return (
    <DashboardShell
      badgeLabel="ADMIN"
      navLabel="Gerenciamento"
      navItems={NAV_ITEMS.map(({ id, label, Icon }) => ({ id, label, Icon }))}
      activeId={section}
      onNavigate={(id) => setSection(id as AdminSection)}
      user={user}
      pageTitle={sectionTitles[section]}
      pageSubtitle="Painel de administração"
      actions={
        <>
          <button type="button" className="hover-surface" style={switchBtn} onClick={() => navigate('/dashboard/creator')}>
            <IconCamera size={14} stroke={1.5} /> Ver como Creator
          </button>
          <button type="button" className="hover-surface" style={switchBtn} onClick={() => navigate('/dashboard/editor')}>
            <IconMovie size={14} stroke={1.5} /> Ver como Editor
          </button>
        </>
      }
    >
      <div key={section} className="anim-fade-up">
        {section === 'dashboard' && <DashboardSection />}
        {section === 'users' && <UsersSection onViewUser={handleViewUser} />}
        {section === 'orders' && <OrdersSection onOpenOrder={(id) => navigate(`/orders/${id}`)} />}
        {section === 'transactions' && <FinanceiroSection />}
        {section === 'subscriptions' && <SubscriptionsSection />}
        {section === 'audit' && <AuditSection />}
      </div>
    </DashboardShell>
  )
}
