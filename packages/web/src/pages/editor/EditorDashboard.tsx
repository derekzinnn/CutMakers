import { useEffect, useState } from 'react'
import {
  IconLayoutDashboard,
  IconBriefcase,
  IconInbox,
  IconUser,
  IconPlus,
  IconEdit,
  IconTrash,
  IconStar,
  IconTrendingUp,
  IconCheck,
  IconClock,
  IconPlayerPlay,
  IconCrown,
  IconMessage2,
  IconLoader2,
  IconRosetteDiscountCheck,
} from '@tabler/icons-react'
import {
  getMySubscription,
  createSubscription,
  type MySubscription,
} from '@/lib/subscriptions'
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell'
import { useAuth } from '@/hooks/use-auth'
import { useEditorMe } from '@/hooks/use-editor-me'
import { useOrders } from '@/hooks/use-orders'
import { api } from '@/lib/api'
import { OrderCard } from '@/components/orders/OrderCard'
import { OrderStatusFilter, filterOrdersByStatus } from '@/components/orders/OrderStatusFilter'
import { PortfolioForm, type PortfolioItemInput } from './components/PortfolioForm'
import { ProfileForm } from './components/ProfileForm'
import { MessagesTab } from '@/components/chat/MessagesTab'
import { OrderDetail } from '@/components/orders/OrderDetail'
import { Modal } from '@/components/ui/Modal'
import { STATUS_LABELS, STATUS_COLORS, type OrderDTO, type OrderStatus } from '@/lib/orders'

type Section = 'overview' | 'portfolio' | 'orders' | 'messages' | 'premium' | 'profile'

const NAV: NavItem[] = [
  { id: 'overview', label: 'Dashboard', Icon: IconLayoutDashboard },
  { id: 'portfolio', label: 'Portfólio', Icon: IconBriefcase },
  { id: 'orders', label: 'Pedidos', Icon: IconInbox },
  { id: 'messages', label: 'Mensagens', Icon: IconMessage2 },
  { id: 'premium', label: 'Premium', Icon: IconCrown },
  { id: 'profile', label: 'Perfil', Icon: IconUser },
]

export function EditorDashboard() {
  const { user } = useAuth()
  const { editor, loading, refetch } = useEditorMe()

  const [section, setSection] = useState<Section>('overview')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortfolioItemInput | undefined>(undefined)
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { orders, loading: ordersLoading, error: ordersError } = useOrders({ role: 'editor' })

  if (!user) return null

  const items = editor?.profile.portfolioItems ?? []
  const sectionTitle = selectedOrderId ? 'Detalhes do pedido' : {
    overview: 'Dashboard',
    portfolio: 'Portfólio',
    orders: 'Pedidos recebidos',
    messages: 'Mensagens',
    premium: 'Premium',
    profile: 'Editar perfil',
  }[section]

  function openCreate() {
    setEditingItem(undefined)
    setFormOpen(true)
  }

  function openEdit(item: NonNullable<typeof items>[number]) {
    setEditingItem({
      id: item.id,
      title: item.title,
      description: item.description ?? '',
      categoryId: item.category.id,
      videoUrl: item.videoUrl,
      thumbnailUrl: item.thumbnailUrl ?? '',
      basePrice: String(item.basePrice),
    })
    setFormOpen(true)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await api.delete(`/portfolio/${deleteTarget.id}`)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setDeleteError(e?.response?.data?.message ?? 'Erro ao remover o projeto')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <DashboardShell
        badgeLabel="EDITOR"
        navItems={NAV}
        activeId={section}
        onNavigate={(id) => {
          setSelectedOrderId(null); setSection(id as Section)
        }}
        onProfileClick={() => { setSelectedOrderId(null); setSection('profile') }}
        user={user}
        pageTitle={sectionTitle}
        pageSubtitle={
          selectedOrderId
            ? undefined
            : section === 'overview'
              ? 'Acompanhe seus projetos e métricas'
              : section === 'portfolio'
                ? `${items.length} ${items.length === 1 ? 'projeto' : 'projetos'}`
                : section === 'orders'
                  ? `${orders.length} ${orders.length === 1 ? 'pedido recebido' : 'pedidos recebidos'}`
                  : section === 'messages'
                    ? 'Converse com seus clientes'
                    : section === 'premium'
                      ? 'Destaque seu perfil e receba mais clientes'
                      : 'Atualize suas informações públicas'
        }
        actions={
          section === 'portfolio' ? (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold transition-all"
              style={{
                background: '#F4631E',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Syne', sans-serif",
              }}
            >
              <IconPlus size={16} stroke={2} />
              Novo projeto
            </button>
          ) : undefined
        }
      >
        {loading ? (
          <div
            className="flex items-center justify-center py-20 text-sm"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Carregando...
          </div>
        ) : (
          <>
            {section === 'overview' && (
              <OverviewSection editor={editor} totalItems={items.length} orders={orders} />
            )}

            {section === 'portfolio' && (
              <PortfolioSection
                items={items}
                onAdd={openCreate}
                onEdit={openEdit}
                onDelete={(id, title) => { setDeleteError(null); setDeleteTarget({ id, title }) }}
              />
            )}

            {section === 'orders' && (
              selectedOrderId ? (
                <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
              ) : ordersLoading ? (
                <div
                  className="flex items-center justify-center py-20 text-sm"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  Carregando pedidos...
                </div>
              ) : ordersError ? (
                <div
                  className="rounded-card p-6 text-center text-sm"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#FCA5A5',
                  }}
                >
                  {ordersError}
                </div>
              ) : orders.length === 0 ? (
                <div
                  className="rounded-card p-12 text-center"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ background: 'rgba(244,99,30,0.1)' }}
                  >
                    <IconInbox size={28} stroke={1.5} color="#F4631E" />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-white">Nenhum pedido ainda</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Quando um creator te contratar, os pedidos aparecerão aqui.
                  </p>
                </div>
              ) : (
                <>
                  <OrderStatusFilter orders={orders} active={orderFilter} onChange={setOrderFilter} />
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {filterOrdersByStatus(orders, orderFilter).map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        perspective="editor"
                        onClick={() => setSelectedOrderId(order.id)}
                      />
                    ))}
                  </div>
                </>
              )
            )}

            {section === 'messages' && <MessagesTab />}

            {section === 'premium' && <PremiumSection />}

            {section === 'profile' && (
              <div className="mx-auto max-w-2xl">
                <ProfileForm editor={editor} userName={user.name} onSaved={refetch} />
              </div>
            )}

          </>
        )}
      </DashboardShell>

      <PortfolioForm
        open={formOpen}
        initial={editingItem}
        onClose={() => setFormOpen(false)}
        onSaved={refetch}
      />

      {/* Confirmação de exclusão de item do portfólio */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        title="Remover projeto"
        subtitle={deleteTarget?.title}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="rounded-[8px] px-4 py-2 text-sm"
              style={{
                background: 'transparent',
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: deleting ? 'not-allowed' : 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="rounded-[8px] px-4 py-2 text-sm font-semibold"
              style={{
                background: '#EF4444',
                color: 'white',
                border: 'none',
                cursor: deleting ? 'not-allowed' : 'pointer',
                opacity: deleting ? 0.7 : 1,
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {deleting ? 'Removendo...' : 'Remover'}
            </button>
          </>
        }
      >
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Esta ação não pode ser desfeita. O vídeo será removido do seu portfólio.
        </p>
        {deleteError && (
          <p
            className="mt-3 rounded-[8px] px-3 py-2 text-xs"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}
          >
            {deleteError}
          </p>
        )}
      </Modal>
    </>
  )
}

// ─── Section: Overview ─────────────────────────────────────────────────────────

// ── Mini gráfico de barras (SVG puro, sem dependências) ───────────────────────

function StatusBarChart({ orders }: { orders: OrderDTO[] }) {
  const counts = new Map<OrderStatus, number>()
  for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1)
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, c]) => c), 1)

  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Sem pedidos ainda — seus projetos aparecerão aqui.
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {entries.map(([status, count]) => (
        <div key={status} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {STATUS_LABELS[status]}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-[4px]" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="h-full rounded-[4px] transition-all"
              style={{ width: `${(count / max) * 100}%`, background: STATUS_COLORS[status], opacity: 0.85 }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-xs font-semibold text-white">{count}</span>
        </div>
      ))}
    </div>
  )
}

// ── Prazos próximos (pedidos ativos com deadline em até 7 dias) ───────────────

const ACTIVE_STATUSES: OrderStatus[] = ['NEGOTIATING', 'AWAITING_PAYMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED']

function UpcomingDeadlines({ orders }: { orders: OrderDTO[] }) {
  const now = Date.now()
  const upcoming = orders
    .filter((o) => o.deadline && ACTIVE_STATUSES.includes(o.status))
    .map((o) => ({ order: o, daysLeft: Math.ceil((new Date(o.deadline!).getTime() - now) / (24 * 60 * 60 * 1000)) }))
    .filter(({ daysLeft }) => daysLeft <= 7)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5)

  if (upcoming.length === 0) {
    return (
      <p className="py-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
        Nenhum prazo vencendo nos próximos 7 dias. 🎉
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {upcoming.map(({ order, daysLeft }) => {
        const overdue = daysLeft < 0
        const urgent = daysLeft <= 2
        const color = overdue ? '#EF4444' : urgent ? '#EAB308' : '#3B82F6'
        return (
          <li
            key={order.id}
            className="flex items-center gap-3 rounded-[8px] px-3 py-2.5"
            style={{ background: `${color}0D`, border: `1px solid ${color}33` }}
          >
            <IconClock size={14} stroke={1.5} style={{ color, flexShrink: 0 }} />
            <span className="flex-1 truncate text-xs text-white">{order.title}</span>
            <span className="shrink-0 text-[11px] font-semibold" style={{ color }}>
              {overdue
                ? `${Math.abs(daysLeft)}d atrasado`
                : daysLeft === 0
                  ? 'vence hoje'
                  : `${daysLeft}d restantes`}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function OverviewSection({
  editor,
  totalItems,
  orders,
}: {
  editor: ReturnType<typeof useEditorMe>['editor']
  totalItems: number
  orders: OrderDTO[]
}) {
  const stats = [
    {
      label: 'Itens no portfólio',
      value: String(totalItems),
      Icon: IconBriefcase,
      hint: totalItems === 0 ? 'Adicione seu primeiro!' : `+0 esta semana`,
    },
    {
      label: 'Trabalhos concluídos',
      value: String(editor?.profile.totalJobs ?? 0),
      Icon: IconCheck,
      hint: 'Total acumulado',
    },
    {
      label: 'Avaliação média',
      value: editor?.profile.avgRating ? editor.profile.avgRating.toFixed(1) : '—',
      Icon: IconStar,
      hint: 'De clientes anteriores',
    },
    {
      label: 'Status',
      value: editor?.profile.isPremium ? 'Premium' : 'Free',
      Icon: editor?.profile.isPremium ? IconCrown : IconTrendingUp,
      hint: editor?.profile.isPremium ? 'Plano ativo' : 'Upgrade disponível',
    },
  ]

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-card p-5"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {s.label}
              </span>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'rgba(244,99,30,0.1)' }}
              >
                <s.Icon size={16} stroke={1.5} color="#F4631E" />
              </span>
            </div>
            <p className="font-heading text-2xl font-bold text-white">{s.value}</p>
            <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {s.hint}
            </p>
          </div>
        ))}
      </div>

      {/* Gráficos: pedidos por status + prazos próximos */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div
          className="rounded-card p-5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h3 className="mb-4 font-heading text-sm font-semibold text-white">Pedidos por status</h3>
          <StatusBarChart orders={orders} />
        </div>
        <div
          className="rounded-card p-5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h3 className="mb-4 font-heading text-sm font-semibold text-white">Prazos próximos</h3>
          <UpcomingDeadlines orders={orders} />
        </div>
      </div>

      {/* Estado vazio se não tem portfólio */}
      {totalItems === 0 && (
        <div
          className="rounded-card p-12 text-center"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'rgba(244,99,30,0.1)' }}
          >
            <IconBriefcase size={28} stroke={1.5} color="#F4631E" />
          </div>
          <h3 className="font-heading text-lg font-bold text-white">
            Seu portfólio está vazio
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Adicione seus melhores projetos para começar a receber clientes.
            Criadores buscam editores com portfólios sólidos.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Section: Portfolio ────────────────────────────────────────────────────────

function PortfolioSection({
  items,
  onAdd,
  onEdit,
  onDelete,
}: {
  items: NonNullable<ReturnType<typeof useEditorMe>['editor']>['profile']['portfolioItems']
  onAdd: () => void
  onEdit: (item: NonNullable<ReturnType<typeof useEditorMe>['editor']>['profile']['portfolioItems'][number]) => void
  onDelete: (id: string, title: string) => void
}) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-card p-12 text-center"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'rgba(244,99,30,0.1)' }}
        >
          <IconBriefcase size={28} stroke={1.5} color="#F4631E" />
        </div>
        <h3 className="font-heading text-lg font-bold text-white">Nenhum projeto ainda</h3>
        <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Adicione seu primeiro projeto e mostre seu trabalho aos criadores.
        </p>
        <button
          onClick={onAdd}
          className="mt-6 inline-flex items-center gap-2 rounded-[8px] px-5 py-2.5 text-sm font-semibold transition-all"
          style={{
            background: '#F4631E',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontFamily: "'Syne', sans-serif",
          }}
        >
          <IconPlus size={16} stroke={2} />
          Adicionar primeiro projeto
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="group overflow-hidden rounded-card"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Thumbnail */}
          <div className="relative aspect-video w-full overflow-hidden" style={{ background: '#0D1B2A' }}>
            {item.thumbnailUrl ? (
              <>
                {/* Fundo desfocado + contain: vídeos verticais não quebram o card */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(${item.thumbnailUrl})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    filter: 'blur(14px) brightness(0.5)', transform: 'scale(1.15)',
                  }}
                />
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="relative h-full w-full object-contain"
                />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <IconPlayerPlay size={32} stroke={1.5} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
            )}
            <a
              href={item.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: '#F4631E' }}
              >
                <IconPlayerPlay size={20} stroke={2} color="white" fill="white" />
              </div>
            </a>
          </div>

          {/* Info */}
          <div className="p-4">
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: 'rgba(244,99,30,0.15)', color: '#F4631E' }}
            >
              {item.category.name}
            </span>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-white">
              {item.title}
            </h3>
            {item.description && (
              <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {item.description}
              </p>
            )}
            <p
              className="mt-2 font-heading text-base font-bold"
              style={{ color: '#F4631E' }}
            >
              R$ {item.basePrice.toFixed(2)}
            </p>

            <div className="mt-3 flex items-center justify-between">
              <span
                className="flex items-center gap-1 text-[10px]"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <IconClock size={11} stroke={1.5} />
                {new Date(item.createdAt).toLocaleDateString('pt-BR')}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => onEdit(item)}
                  className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                  }}
                >
                  <IconEdit size={13} stroke={1.5} />
                </button>
                <button
                  onClick={() => onDelete(item.id, item.title)}
                  className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
                  style={{
                    background: 'rgba(239,68,68,0.05)',
                    border: '1px solid rgba(239,68,68,0.15)',
                    color: 'rgba(239,68,68,0.8)',
                    cursor: 'pointer',
                  }}
                >
                  <IconTrash size={13} stroke={1.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Section: Premium ──────────────────────────────────────────────────────────

const PREMIUM_BENEFITS = [
  'Aparecer primeiro nas buscas dos criadores',
  'Badge verificado no seu perfil público',
  'Sem limite de projetos simultâneos',
]

function PremiumSection() {
  const [data, setData] = useState<MySubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [charge, setCharge] = useState<{ pixCode: string | null; paymentUrl: string | null } | null>(null)

  async function load() {
    setLoading(true)
    try {
      setData(await getMySubscription())
    } catch {
      setError('Não foi possível carregar sua assinatura')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSubscribe() {
    setBusy(true)
    setError(null)
    setCharge(null)
    try {
      const result = await createSubscription()
      if (result.paymentUrl) window.open(result.paymentUrl, '_blank')
      setCharge({ pixCode: result.pixCode, paymentUrl: result.paymentUrl })
      await load()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao iniciar assinatura')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <IconLoader2 size={26} className="animate-spin" style={{ color: '#F4631E' }} />
      </div>
    )
  }

  const isPremium = data?.isPremium ?? false
  const expiresAt = data?.premiumExpiresAt ? new Date(data.premiumExpiresAt) : null
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null
  const price = data?.price ?? 39.9
  const renewable = daysLeft !== null && daysLeft <= 5

  // ── Estado premium ativo ──
  if (isPremium) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div
          className="rounded-card p-8 text-center"
          style={{ background: 'linear-gradient(180deg, rgba(244,99,30,0.12), rgba(244,99,30,0.03))', border: '1px solid rgba(244,99,30,0.3)' }}
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(244,99,30,0.15)' }}>
            <IconCrown size={30} stroke={1.5} color="#F4631E" />
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(244,99,30,0.15)', color: '#F4631E' }}>
            <IconRosetteDiscountCheck size={14} stroke={2} />
            PREMIUM ATIVO
          </div>
          <h3 className="font-heading text-xl font-bold text-white">Você é um editor Premium</h3>
          {expiresAt && (
            <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Válido até {expiresAt.toLocaleDateString('pt-BR')}
              {daysLeft !== null && daysLeft >= 0 && (
                <span style={{ color: 'rgba(255,255,255,0.4)' }}> · {daysLeft} {daysLeft === 1 ? 'dia restante' : 'dias restantes'}</span>
              )}
            </p>
          )}
        </div>

        <div className="rounded-card p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <ul className="space-y-3">
            {PREMIUM_BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-white">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(34,197,94,0.15)' }}>
                  <IconCheck size={12} stroke={2.5} color="#22C55E" />
                </span>
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <button
              onClick={handleSubscribe}
              disabled={busy || !renewable}
              className="flex items-center gap-2 rounded-[8px] px-5 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: renewable ? '#F4631E' : 'rgba(255,255,255,0.06)',
                color: renewable ? 'white' : 'rgba(255,255,255,0.4)',
                border: renewable ? 'none' : '1px solid rgba(255,255,255,0.1)',
                cursor: busy || !renewable ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.7 : 1,
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {busy ? <IconLoader2 size={15} className="animate-spin" /> : <IconCrown size={15} stroke={1.5} />}
              Renovar assinatura
            </button>
            {!renewable && (
              <p className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                A renovação fica disponível nos últimos 5 dias antes do vencimento.
              </p>
            )}
            {error && <p className="mt-2 text-xs" style={{ color: '#FCA5A5' }}>{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  // ── Estado free (upsell) ──
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-card p-8" style={{ background: 'linear-gradient(180deg, rgba(244,99,30,0.1), rgba(255,255,255,0.02))', border: '1px solid rgba(244,99,30,0.25)' }}>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(244,99,30,0.15)' }}>
            <IconCrown size={24} stroke={1.5} color="#F4631E" />
          </div>
          <div>
            <h3 className="font-heading text-xl font-bold text-white">CutMakers Premium</h3>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Mais visibilidade, mais clientes.</p>
          </div>
        </div>

        <ul className="space-y-3">
          {PREMIUM_BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-3 text-sm text-white">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(244,99,30,0.15)' }}>
                <IconCheck size={12} stroke={2.5} color="#F4631E" />
              </span>
              {b}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-baseline gap-1.5">
          <span className="font-heading text-3xl font-bold text-white">R$ {price.toFixed(2).replace('.', ',')}</span>
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>/mês</span>
        </div>

        <button
          onClick={handleSubscribe}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-[8px] py-3 text-sm font-semibold transition-all"
          style={{ background: '#F4631E', color: 'white', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: "'Syne', sans-serif" }}
        >
          {busy ? <IconLoader2 size={16} className="animate-spin" /> : <IconCrown size={16} stroke={1.5} />}
          {busy ? 'Gerando cobrança...' : `Assinar Premium — R$ ${price.toFixed(2).replace('.', ',')}/mês`}
        </button>

        {charge && (charge.pixCode || charge.paymentUrl) && (
          <div className="mt-4 rounded-[8px] px-4 py-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-sm font-medium" style={{ color: '#3B82F6' }}>Cobrança PIX gerada</p>
            {charge.paymentUrl && (
              <a href={charge.paymentUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline" style={{ color: '#93C5FD' }}>
                Abrir página de pagamento
              </a>
            )}
            {charge.pixCode && (
              <p className="mt-2 break-all rounded-[6px] px-2 py-1.5 text-[11px]" style={{ background: 'rgba(0,0,0,0.2)', color: 'rgba(255,255,255,0.7)' }}>
                {charge.pixCode}
              </p>
            )}
            <p className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Assim que o pagamento for confirmado, seu perfil vira Premium automaticamente.
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-xs" style={{ color: '#FCA5A5' }}>{error}</p>}
      </div>
    </div>
  )
}
