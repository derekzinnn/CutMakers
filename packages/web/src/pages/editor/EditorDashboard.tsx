import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
} from '@tabler/icons-react'
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell'
import { useAuth } from '@/hooks/use-auth'
import { useEditorMe } from '@/hooks/use-editor-me'
import { useOrders } from '@/hooks/use-orders'
import { api } from '@/lib/api'
import { OrderCard } from '@/components/orders/OrderCard'
import { PortfolioForm, type PortfolioItemInput } from './components/PortfolioForm'
import { ProfileForm } from './components/ProfileForm'

type Section = 'overview' | 'portfolio' | 'orders' | 'profile'

const NAV: NavItem[] = [
  { id: 'overview', label: 'Dashboard', Icon: IconLayoutDashboard },
  { id: 'portfolio', label: 'Portfólio', Icon: IconBriefcase },
  { id: 'orders', label: 'Pedidos', Icon: IconInbox },
  { id: 'profile', label: 'Perfil', Icon: IconUser },
]

export function EditorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { editor, loading, refetch } = useEditorMe()

  const [section, setSection] = useState<Section>('overview')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortfolioItemInput | undefined>(undefined)

  const { orders, loading: ordersLoading, error: ordersError } = useOrders({ role: 'editor' })

  if (!user) return null

  const items = editor?.profile.portfolioItems ?? []
  const sectionTitle = {
    overview: 'Dashboard',
    portfolio: 'Portfólio',
    orders: 'Pedidos recebidos',
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

  async function deleteItem(id: string) {
    if (!confirm('Tem certeza que deseja remover este item?')) return
    try {
      await api.delete(`/portfolio/${id}`)
      refetch()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      alert(e?.response?.data?.message ?? 'Erro ao remover')
    }
  }

  return (
    <>
      <DashboardShell
        badgeLabel="EDITOR"
        navItems={NAV}
        activeId={section}
        onNavigate={(id) => setSection(id as Section)}
        user={user}
        pageTitle={sectionTitle}
        pageSubtitle={
          section === 'overview'
            ? 'Acompanhe seus projetos e métricas'
            : section === 'portfolio'
              ? `${items.length} ${items.length === 1 ? 'projeto' : 'projetos'}`
              : section === 'orders'
                ? `${orders.length} ${orders.length === 1 ? 'pedido recebido' : 'pedidos recebidos'}`
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
              <OverviewSection editor={editor} totalItems={items.length} />
            )}

            {section === 'portfolio' && (
              <PortfolioSection
                items={items}
                onAdd={openCreate}
                onEdit={openEdit}
                onDelete={deleteItem}
              />
            )}

            {section === 'orders' && (
              ordersLoading ? (
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
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {orders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      perspective="editor"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    />
                  ))}
                </div>
              )
            )}

            {section === 'profile' && (
              <div
                className="mx-auto max-w-2xl rounded-card p-8"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
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
    </>
  )
}

// ─── Section: Overview ─────────────────────────────────────────────────────────

function OverviewSection({
  editor,
  totalItems,
}: {
  editor: ReturnType<typeof useEditorMe>['editor']
  totalItems: number
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
  onDelete: (id: string) => void
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
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="h-full w-full object-cover"
              />
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
                  onClick={() => onDelete(item.id)}
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
