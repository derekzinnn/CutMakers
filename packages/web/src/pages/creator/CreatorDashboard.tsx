import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  IconSearch,
  IconBriefcase,
  IconMessage2,
  IconHeart,
  IconCreditCard,
  IconUser,
  IconPlayerPlay,
  IconStarFilled,
  IconArrowRight,
  IconBolt,
  IconRosetteDiscountCheckFilled,
  IconPlus,
  IconChevronDown,
  IconAdjustmentsHorizontal,
} from '@tabler/icons-react'
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell'
import { useAuth } from '@/hooks/use-auth'
import { useCategories } from '@/hooks/use-categories'
import { useOrders } from '@/hooks/use-orders'
import { api } from '@/lib/api'
import { OrderCard } from '@/components/orders/OrderCard'
import { OrderStatusFilter, filterOrdersByStatus } from '@/components/orders/OrderStatusFilter'
import { MessagesTab } from '@/components/chat/MessagesTab'
import { OrderDetail } from '@/components/orders/OrderDetail'
import type { OrderStatus } from '@/lib/orders'

// ─── Types ────────────────────────────────────────────────────────────────────

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

type Section = 'feed' | 'orders' | 'messages' | 'favorites' | 'payments' | 'account'
type SortBy = 'rating' | 'jobs' | 'price-asc' | 'price-desc'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  '#3B82F6', '#10B981', '#8B5CF6', '#EC4899',
  '#14B8A6', '#F59E0B', '#EF4444', '#06B6D4', '#F4631E',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[Math.abs(hash)]
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreatorDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { categories } = useCategories()
  const [searchParams, setSearchParams] = useSearchParams()

  const [section, setSection] = useState<Section>(
    (searchParams.get('section') as Section) || 'feed',
  )
  const [editors, setEditors] = useState<EditorListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [premiumOnly, setPremiumOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('rating')

  const { orders, loading: ordersLoading, error: ordersError } = useOrders({ role: 'creator' })
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'ALL'>('ALL')

  const navItems: NavItem[] = useMemo(
    () => [
      { id: 'feed', label: 'Buscar editores', Icon: IconSearch },
      {
        id: 'orders',
        label: 'Meus pedidos',
        Icon: IconBriefcase,
        badge: orders.length > 0 ? String(orders.length) : undefined,
      },
      { id: 'messages', label: 'Mensagens', Icon: IconMessage2 },
      { id: 'favorites', label: 'Favoritos', Icon: IconHeart },
      { id: 'payments', label: 'Pagamentos', Icon: IconCreditCard },
      { id: 'account', label: 'Minha conta', Icon: IconUser },
    ],
    [orders.length],
  )

  function changeSection(next: Section) {
    setSelectedOrderId(null)
    setSection(next)
    if (next !== 'feed') setSearchParams({ section: next })
    else setSearchParams({})
  }

  const loadEditors = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: '50' }
      if (selectedCategory) params.category = selectedCategory
      if (search) params.search = search
      if (premiumOnly) params.premium = 'true'

      const { data } = await api.get<ListResponse>('/editors', { params })

      let sorted = [...data.editors]
      if (sortBy === 'rating') sorted.sort((a, b) => b.avgRating - a.avgRating)
      else if (sortBy === 'jobs') sorted.sort((a, b) => b.totalJobs - a.totalJobs)
      else if (sortBy === 'price-asc')
        sorted.sort((a, b) => {
          const ma = a.portfolioPreview.length
            ? Math.min(...a.portfolioPreview.map(p => p.basePrice))
            : Infinity
          const mb = b.portfolioPreview.length
            ? Math.min(...b.portfolioPreview.map(p => p.basePrice))
            : Infinity
          return ma - mb
        })
      else if (sortBy === 'price-desc')
        sorted.sort((a, b) => {
          const ma = a.portfolioPreview.length
            ? Math.min(...a.portfolioPreview.map(p => p.basePrice))
            : 0
          const mb = b.portfolioPreview.length
            ? Math.min(...b.portfolioPreview.map(p => p.basePrice))
            : 0
          return mb - ma
        })

      setEditors(sorted)
      setTotal(data.total)
    } catch {
      // Falha silenciosa: mantém a lista atual; sem logs de payload no console
      setEditors([])
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, search, premiumOnly, sortBy])

  // Debounce search input → search state
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (section === 'feed') {
      const t = setTimeout(loadEditors, 100)
      return () => clearTimeout(t)
    }
  }, [section, loadEditors])

  if (!user) return null

  return (
    <DashboardShell
      navLabel="CRIADOR"
      navItems={navItems}
      activeId={section}
      onNavigate={(id) => changeSection(id as Section)}
      onProfileClick={() => changeSection('account')}
      user={user}
      pageTitle={
        selectedOrderId
          ? 'Detalhes do pedido'
          : section === 'feed'
            ? 'Encontrar editor'
            : section === 'orders'
              ? 'Meus pedidos'
              : section === 'messages'
                ? 'Mensagens'
                : section === 'favorites'
                  ? 'Favoritos'
                  : section === 'payments'
                    ? 'Pagamentos'
                    : 'Minha conta'
      }
      pageSubtitle={
        selectedOrderId
          ? undefined
          : section === 'feed'
            ? `${total.toLocaleString('pt-BR')} editores disponíveis · filtre por categoria e prazo`
            : section === 'orders'
              ? `${orders.length} ${orders.length === 1 ? 'projeto' : 'projetos'}`
              : undefined
      }
      actions={
        section === 'feed' && !selectedOrderId ? (
          <button
            onClick={() => changeSection('orders')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#F4631E', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 14px', fontSize: 13,
              fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne', sans-serif",
            }}
          >
            <IconPlus size={14} stroke={2.5} />
            Novo pedido
          </button>
        ) : undefined
      }
    >
      {/* ── Buscar editores ── */}
      {section === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Search card */}
          <div
            style={{
              background: '#162436',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {/* Text search */}
            <div
              style={{
                flex: '1 1 240px',
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '9px 12px',
              }}
            >
              <IconSearch size={14} stroke={1.5} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Buscar por nome ou especialidade..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 13, color: '#fff', fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>

            {/* Category select */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <select
                value={selectedCategory ?? ''}
                onChange={e => setSelectedCategory(e.target.value || null)}
                style={{
                  appearance: 'none', WebkitAppearance: 'none',
                  background: '#1E3045',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '9px 36px 9px 12px',
                  fontSize: 13, color: selectedCategory ? '#fff' : 'rgba(255,255,255,0.45)',
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", outline: 'none',
                  minWidth: 130, colorScheme: 'dark',
                }}
              >
                <option value="">Todas categorias</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <IconChevronDown
                size={14} stroke={1.5}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'rgba(255,255,255,0.4)', pointerEvents: 'none',
                }}
              />
            </div>

            {/* Ordenar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                style={{
                  appearance: 'none', WebkitAppearance: 'none',
                  background: '#1E3045',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '9px 36px 9px 12px',
                  fontSize: 13, color: '#fff', cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif", outline: 'none',
                  minWidth: 150, colorScheme: 'dark',
                }}
              >
                <option value="rating">Mais avaliados</option>
                <option value="jobs">Mais experientes</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
              </select>
              <IconChevronDown
                size={14} stroke={1.5}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  color: 'rgba(255,255,255,0.4)', pointerEvents: 'none',
                }}
              />
            </div>

            {/* Buscar button */}
            <button
              onClick={loadEditors}
              style={{
                background: '#F4631E', color: '#fff', border: 'none',
                borderRadius: 8, padding: '9px 20px', fontSize: 13,
                fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne', sans-serif",
                flexShrink: 0,
              }}
            >
              Buscar
            </button>
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Chip active={!selectedCategory && !premiumOnly} onClick={() => { setSelectedCategory(null); setPremiumOnly(false) }}>
              <IconAdjustmentsHorizontal size={13} stroke={1.5} />
              Todos
            </Chip>

            {categories.map(c => (
              <Chip
                key={c.id}
                active={selectedCategory === c.name && !premiumOnly}
                onClick={() => { setSelectedCategory(selectedCategory === c.name ? null : c.name); setPremiumOnly(false) }}
              >
                {c.name}
              </Chip>
            ))}

            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0 }} />

            <Chip active={premiumOnly} accent onClick={() => { setPremiumOnly(!premiumOnly); setSelectedCategory(null) }}>
              <IconBolt size={12} stroke={2} />
              Premium
            </Chip>
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              Carregando editores...
            </div>
          ) : editors.length === 0 ? (
            <div
              style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, padding: '64px 24px', textAlign: 'center',
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <IconSearch size={24} stroke={1.5} style={{ color: 'rgba(255,255,255,0.25)' }} />
              </div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff', margin: '0 0 8px' }}>
                Nenhum editor encontrado
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: 0 }}>
                Tente outros filtros — novos editores chegam toda semana.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16,
              }}
            >
              {editors.map(editor => (
                <EditorCard key={editor.id} editor={editor} onNavigate={navigate} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Meus pedidos ── */}
      {section === 'orders' && (
        selectedOrderId ? (
          <OrderDetail orderId={selectedOrderId} onBack={() => setSelectedOrderId(null)} />
        ) : ordersLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Carregando pedidos...
          </div>
        ) : ordersError ? (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 24, color: '#FCA5A5', fontSize: 13, textAlign: 'center' }}>
            {ordersError}
          </div>
        ) : orders.length === 0 ? (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(244,99,30,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <IconBriefcase size={24} stroke={1.5} color="#F4631E" />
            </div>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff', margin: '0 0 8px' }}>
              Sem pedidos ainda
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, margin: '0 0 20px' }}>
              Escolha um editor e crie seu primeiro projeto.
            </p>
            <button
              onClick={() => changeSection('feed')}
              style={{ background: '#F4631E', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}
            >
              Explorar editores
            </button>
          </div>
        ) : (
          <>
            <OrderStatusFilter orders={orders} active={orderFilter} onChange={setOrderFilter} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
              {filterOrdersByStatus(orders, orderFilter).map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  perspective="creator"
                  onClick={() => setSelectedOrderId(order.id)}
                />
              ))}
            </div>
          </>
        )
      )}

      {/* ── Mensagens ── */}
      {section === 'messages' && <MessagesTab />}

      {/* ── Em breve ── */}
      {(section === 'favorites' || section === 'payments' || section === 'account') && (
        <ComingSoon section={section} />
      )}
    </DashboardShell>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  children,
  active,
  accent,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  accent?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 20,
        fontSize: 12, fontWeight: active ? 600 : 400,
        cursor: 'pointer', border: 'none', transition: 'all 0.15s',
        fontFamily: "'DM Sans', sans-serif",
        background: active
          ? accent ? '#F4631E' : '#F4631E'
          : 'rgba(255,255,255,0.06)',
        color: active ? '#fff' : 'rgba(255,255,255,0.6)',
      }}
    >
      {children}
    </button>
  )
}

// ─── Editor card ──────────────────────────────────────────────────────────────

function EditorCard({
  editor,
  onNavigate,
}: {
  editor: EditorListItem
  onNavigate: (path: string) => void
}) {
  const minPrice = editor.portfolioPreview.length
    ? Math.min(...editor.portfolioPreview.map(p => p.basePrice))
    : null
  const thumbnail = editor.portfolioPreview[0]?.thumbnailUrl ?? null
  const avatarColor = getAvatarColor(editor.name)

  const badge = editor.isPremium
    ? 'Premium'
    : editor.totalJobs >= 200
      ? 'Top 10'
      : editor.totalJobs >= 50
        ? 'Destaque'
        : null

  return (
    <div
      onClick={() => onNavigate(`/editors/${editor.userId}`)}
      style={{
        background: '#162436',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(244,99,30,0.35)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* ── Thumbnail ── */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '16/10',
          background: '#1E3045',
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 20px)',
          overflow: 'hidden',
        }}
      >
        {thumbnail && (
          <img
            src={thumbnail}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {/* Play button */}
        <div
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            <IconPlayerPlay size={16} stroke={1.5} style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 2 }} />
          </div>
        </div>
        {/* Badge */}
        {badge && (
          <div
            style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(255,255,255,0.92)',
              color: '#0D1B2A', fontSize: 11, fontWeight: 700,
              padding: '3px 9px', borderRadius: 20,
              fontFamily: "'DM Sans', sans-serif",
              backdropFilter: 'blur(4px)',
            }}
          >
            {badge}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '14px 16px 16px' }}>
        {/* Label */}
        <p
          style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
            marginBottom: 12, fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Highlight Reel
        </p>

        {/* Editor row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {/* Avatar */}
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: avatarColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 12, fontWeight: 800,
              color: '#fff', fontFamily: "'Syne', sans-serif",
              overflow: 'hidden',
            }}
          >
            {editor.avatarUrl ? (
              <img src={editor.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initials(editor.name)
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <span
                style={{
                  fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 14,
                  color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {editor.name}
              </span>
              <IconRosetteDiscountCheckFilled size={13} color="#F4631E" style={{ flexShrink: 0 }} />
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1 }}>
              {editor.categories.slice(0, 3).map(c => c.name).join(' · ')}
            </p>
          </div>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <IconStarFilled size={11} color="#F4631E" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Syne', sans-serif" }}>
              {editor.avgRating ? editor.avgRating.toFixed(1) : '—'}
            </span>
          </div>
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <span
            style={{
              fontSize: 11, color: 'rgba(255,255,255,0.65)',
              background: 'rgba(255,255,255,0.07)',
              borderRadius: 20, padding: '3px 10px',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {editor.totalJobs} jobs
          </span>
        </div>

        {/* Price + CTA */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p
              style={{
                fontSize: 10, color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                margin: '0 0 3px', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              A partir de
            </p>
            <p
              style={{
                fontFamily: "'Syne', sans-serif", fontWeight: 800,
                fontSize: 22, color: '#fff', lineHeight: 1, margin: 0,
              }}
            >
              {minPrice != null ? `R$ ${formatPrice(minPrice)}` : '—'}
            </p>
          </div>

          <button
            onClick={e => { e.stopPropagation(); onNavigate(`/editors/${editor.userId}`) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#F4631E', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 16px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Syne', sans-serif",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#E0551A')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F4631E')}
          >
            Ver perfil
            <IconArrowRight size={14} stroke={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Coming soon placeholder ──────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  messages: 'Mensagens',
  favorites: 'Favoritos',
  payments: 'Pagamentos',
  account: 'Minha conta',
}

function ComingSoon({ section }: { section: Section }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: '80px 24px', textAlign: 'center',
      }}
    >
      <h3
        style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 700,
          fontSize: 17, color: '#fff', margin: '0 0 8px',
        }}
      >
        {SECTION_LABELS[section]} em breve
      </h3>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
        Esta seção está sendo construída e chegará em breve.
      </p>
    </div>
  )
}
