import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  IconUsers,
  IconBriefcase,
  IconSearch,
  IconStar,
  IconCrown,
  IconPlayerPlay,
} from '@tabler/icons-react'
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell'
import { useAuth } from '@/hooks/use-auth'
import { useCategories } from '@/hooks/use-categories'
import { useOrders } from '@/hooks/use-orders'
import { api } from '@/lib/api'
import { OrderCard } from '@/components/orders/OrderCard'

const NAV: NavItem[] = [
  { id: 'feed', label: 'Buscar editores', Icon: IconUsers },
  { id: 'orders', label: 'Meus pedidos', Icon: IconBriefcase },
]

interface EditorListItem {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  bio: string | null
  isPremium: boolean
  avgRating: number
  totalJobs: number
  categories: { id: string; name: string }[]
  portfolioPreview: { id: string; title: string; thumbnailUrl: string | null; basePrice: number }[]
}

interface ListResponse {
  editors: EditorListItem[]
  total: number
  page: number
  totalPages: number
}

export function CreatorDashboard() {
  const { user } = useAuth()
  const { categories } = useCategories()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialSection = (searchParams.get('section') === 'orders' ? 'orders' : 'feed') as 'feed' | 'orders'
  const [section, setSection] = useState<'feed' | 'orders'>(initialSection)
  const [editors, setEditors] = useState<EditorListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { orders, loading: ordersLoading, error: ordersError } = useOrders({ role: 'creator' })

  function changeSection(next: 'feed' | 'orders') {
    setSection(next)
    if (next === 'orders') setSearchParams({ section: 'orders' })
    else setSearchParams({})
  }

  const loadEditors = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '24' }
      if (selectedCategory) params.category = selectedCategory
      if (search) params.search = search

      const { data } = await api.get<ListResponse>('/editors', { params })
      setEditors(data.editors)
      setTotal(data.total)
    } catch (err) {
      console.error('Erro ao carregar editores:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, search])

  useEffect(() => {
    if (section === 'feed') {
      const timer = setTimeout(loadEditors, 300) // debounce do search
      return () => clearTimeout(timer)
    }
  }, [section, loadEditors])

  if (!user) return null

  return (
    <DashboardShell
      badgeLabel="CREATOR"
      navItems={NAV}
      activeId={section}
      onNavigate={(id) => changeSection(id as 'feed' | 'orders')}
      user={user}
      pageTitle={section === 'feed' ? 'Buscar editores' : 'Meus pedidos'}
      pageSubtitle={
        section === 'feed'
          ? `${total} ${total === 1 ? 'editor disponível' : 'editores disponíveis'}`
          : `${orders.length} ${orders.length === 1 ? 'projeto' : 'projetos'}`
      }
    >
      {section === 'feed' && (
        <div className="space-y-6">
          {/* Busca + filtros */}
          <div
            className="flex flex-col gap-3 rounded-card p-4 md:flex-row md:items-center"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              className="flex flex-1 items-center gap-2 rounded-[8px] px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <IconSearch size={14} stroke={1.5} style={{ color: 'rgba(255,255,255,0.4)' }} />
              <input
                type="text"
                placeholder="Buscar por nome do editor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              />
            </div>
          </div>

          {/* Pills de categoria */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: !selectedCategory ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.05)',
                color: !selectedCategory ? '#F4631E' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${!selectedCategory ? 'rgba(244,99,30,0.3)' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer',
              }}
            >
              Todas
            </button>
            {categories.map((c) => {
              const active = selectedCategory === c.name
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(active ? null : c.name)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: active ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.05)',
                    color: active ? '#F4631E' : 'rgba(255,255,255,0.6)',
                    border: `1px solid ${active ? 'rgba(244,99,30,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer',
                  }}
                >
                  {c.name}
                </button>
              )
            })}
          </div>

          {/* Grid de editores */}
          {loading ? (
            <div
              className="flex items-center justify-center py-20 text-sm"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Carregando editores...
            </div>
          ) : editors.length === 0 ? (
            <div
              className="rounded-card p-12 text-center"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <IconUsers size={28} stroke={1.5} style={{ color: 'rgba(255,255,255,0.3)' }} />
              </div>
              <h3 className="font-heading text-lg font-bold text-white">
                Nenhum editor encontrado
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Tente outros filtros ou aguarde — novos editores chegam toda semana.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {editors.map((editor) => (
                <EditorCard key={editor.id} editor={editor} />
              ))}
            </div>
          )}
        </div>
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
              <IconBriefcase size={28} stroke={1.5} color="#F4631E" />
            </div>
            <h3 className="font-heading text-lg font-bold text-white">Sem pedidos ainda</h3>
            <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Escolha um editor no feed e crie seu primeiro projeto.
            </p>
            <button
              onClick={() => changeSection('feed')}
              className="mt-5 rounded-[8px] px-4 py-2 text-sm font-semibold transition-all"
              style={{
                background: '#F4631E',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Syne', sans-serif",
              }}
            >
              Explorar editores
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} perspective="creator" />
            ))}
          </div>
        )
      )}
    </DashboardShell>
  )
}

// ─── Card de editor ────────────────────────────────────────────────────────────

function EditorCard({ editor }: { editor: EditorListItem }) {
  return (
    <Link
      to={`/editors/${editor.userId}`}
      className="group block overflow-hidden rounded-card transition-all"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        textDecoration: 'none',
      }}
    >
      {/* Preview do portfólio */}
      <div className="grid aspect-[3/1] grid-cols-3 gap-px" style={{ background: 'rgba(0,0,0,0.3)' }}>
        {[0, 1, 2].map((i) => {
          const p = editor.portfolioPreview[i]
          return (
            <div key={i} className="relative overflow-hidden" style={{ background: '#0D1B2A' }}>
              {p?.thumbnailUrl ? (
                <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <IconPlayerPlay size={16} stroke={1.5} style={{ color: 'rgba(255,255,255,0.15)' }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-sm font-bold text-white"
            style={{ background: '#F4631E' }}
          >
            {editor.avatarUrl ? (
              <img src={editor.avatarUrl} alt={editor.name} className="h-full w-full object-cover" />
            ) : (
              editor.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-heading text-sm font-semibold text-white">
                {editor.name}
              </h3>
              {editor.isPremium && (
                <IconCrown size={12} stroke={1.5} color="#F4631E" />
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <span className="flex items-center gap-0.5">
                <IconStar size={10} stroke={1.5} color="#F4631E" />
                {editor.avgRating ? editor.avgRating.toFixed(1) : '—'}
              </span>
              <span>·</span>
              <span>{editor.totalJobs} {editor.totalJobs === 1 ? 'job' : 'jobs'}</span>
            </div>
          </div>
        </div>

        {editor.bio && (
          <p
            className="mt-3 line-clamp-2 text-xs"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            {editor.bio}
          </p>
        )}

        {/* Categorias */}
        {editor.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {editor.categories.slice(0, 3).map((c) => (
              <span
                key={c.id}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {c.name}
              </span>
            ))}
            {editor.categories.length > 3 && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                +{editor.categories.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
