import { Avatar, avatarColor } from '@/components/ui/Avatar'
import { formatMoney as money } from '@/lib/format'
import { SkeletonCards } from '@/components/ui/Skeleton'
import { toggleFavorite, listFavoriteIds, listFavorites, type FavoriteEditor } from '@/lib/favorites'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  IconSearch,
  IconBriefcase,
  IconMessage2,
  IconHeart,
  IconEye,
  IconEyeOff,
  IconHeartFilled,
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
  IconLoader2,
  IconChevronLeft,
  IconChevronRight,
  IconLock,
  IconCircleCheck,
  IconFileDescription,
} from '@tabler/icons-react'
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell'
import { useAuth } from '@/hooks/use-auth'
import { uploadFile } from '@/lib/upload'
import { updateMe, changePassword } from '@/lib/account'
import { useCategories } from '@/hooks/use-categories'
import { useOrders } from '@/hooks/use-orders'
import { api } from '@/lib/api'
import { OrderCard } from '@/components/orders/OrderCard'
import { OrderStatusFilter, filterOrdersByStatus } from '@/components/orders/OrderStatusFilter'
import { MessagesTab } from '@/components/chat/MessagesTab'
import { OrderDetail } from '@/components/orders/OrderDetail'
import { TRANSACTION_LABELS, type OrderStatus, type TransactionStatus } from '@/lib/orders'
import { getMyPayments, type MyPayment, type PaymentsSummary } from '@/lib/payments'
import { listMyRequests } from '@/lib/requests'
import { CreatorRequestsSection } from '@/components/requests/CreatorRequestsSection'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditorListItem {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  bio: string | null
  isPremium: boolean
  verified: boolean
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

type Section = 'feed' | 'orders' | 'requests' | 'messages' | 'favorites' | 'payments' | 'account'
type SortBy = 'rating' | 'jobs' | 'price-asc' | 'price-desc'

// ─── Helpers ──────────────────────────────────────────────────────────────────



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

  // Badge de "Minhas solicitações": propostas pendentes em solicitações abertas
  const [pendingProposals, setPendingProposals] = useState(0)

  // Favoritos: Set de userId dos editores favoritados, para o coracao dos cards
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    listFavoriteIds().then((ids) => setFavoriteIds(new Set(ids))).catch(() => {})
  }, [])

  async function onToggleFavorite(editorUserId: string) {
    // Otimista: atualiza o Set na hora, reverte se a request falhar
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      next.has(editorUserId) ? next.delete(editorUserId) : next.add(editorUserId)
      return next
    })
    try {
      await toggleFavorite(editorUserId)
    } catch {
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        next.has(editorUserId) ? next.delete(editorUserId) : next.add(editorUserId)
        return next
      })
    }
  }
  const refreshRequestsBadge = useCallback(() => {
    listMyRequests(1)
      .then((res) => setPendingProposals(res.pendingProposalsTotal))
      .catch(() => {})
  }, [])
  useEffect(() => { refreshRequestsBadge() }, [refreshRequestsBadge])

  const navItems: NavItem[] = useMemo(
    () => [
      { id: 'feed', label: 'Buscar editores', Icon: IconSearch },
      {
        id: 'orders',
        label: 'Meus pedidos',
        Icon: IconBriefcase,
        badge: orders.length > 0 ? String(orders.length) : undefined,
      },
      {
        id: 'requests',
        label: 'Minhas solicitações',
        Icon: IconFileDescription,
        badge: pendingProposals > 0 ? String(pendingProposals) : undefined,
      },
      { id: 'messages', label: 'Mensagens', Icon: IconMessage2 },
      { id: 'favorites', label: 'Favoritos', Icon: IconHeart },
      { id: 'payments', label: 'Pagamentos', Icon: IconCreditCard },
      { id: 'account', label: 'Minha conta', Icon: IconUser },
    ],
    [orders.length, pendingProposals],
  )

  function changeSection(next: Section) {
    setSelectedOrderId(null)
    setSection(next)
    if (next !== 'feed') setSearchParams({ section: next })
    else setSearchParams({})
  }

  // Navegação externa (ex.: clique numa notificação) muda só a URL — sincroniza a seção
  const sectionParam = searchParams.get('section') as Section | null
  useEffect(() => {
    if (sectionParam && sectionParam !== section) {
      setSelectedOrderId(null)
      setSection(sectionParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionParam])

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
              : section === 'requests'
                ? 'Minhas solicitações'
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
              : section === 'requests'
                ? 'Publique um projeto e receba propostas de editores'
              : undefined
      }
      actions={
        section === 'feed' && !selectedOrderId ? (
          <button
            onClick={() => changeSection('orders')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--brand)', color: '#fff', border: 'none',
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
              background: 'var(--card)',
              border: '1px solid var(--border)',
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
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 8, padding: '9px 12px',
              }}
            >
              <IconSearch size={14} stroke={1.5} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
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
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--input)',
                  borderRadius: 8, padding: '9px 36px 9px 12px',
                  fontSize: 13, color: selectedCategory ? '#fff' : 'var(--muted-foreground)',
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
                  color: 'var(--muted-foreground)', pointerEvents: 'none',
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
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--input)',
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
                  color: 'var(--muted-foreground)', pointerEvents: 'none',
                }}
              />
            </div>

            {/* Buscar button */}
            <button
              onClick={loadEditors}
              style={{
                background: 'var(--brand)', color: '#fff', border: 'none',
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

            <div style={{ width: 1, height: 20, background: 'var(--input)', margin: '0 2px', flexShrink: 0 }} />

            <Chip active={premiumOnly} accent onClick={() => { setPremiumOnly(!premiumOnly); setSelectedCategory(null) }}>
              <IconBolt size={12} stroke={2} />
              Premium
            </Chip>
          </div>

          {/* Grid */}
          {loading ? (
            /* Mesma grade de cards do resultado real: a tela nao salta quando
               os editores chegam */
            <SkeletonCards count={6} />
          ) : editors.length === 0 ? (
            <div
              style={{
                background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '64px 24px', textAlign: 'center',
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <IconSearch size={24} stroke={1.5} style={{ color: 'var(--muted-foreground)' }} />
              </div>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff', margin: '0 0 8px' }}>
                Nenhum editor encontrado
              </h3>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: 0 }}>
                Tente outros filtros — novos editores chegam toda semana.
              </p>
            </div>
          ) : (
            <div
              className="anim-stagger"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16,
              }}
            >
              {editors.map(editor => (
                <EditorCard
                  key={editor.id}
                  editor={editor}
                  onNavigate={navigate}
                  favorited={favoriteIds.has(editor.userId)}
                  onToggleFavorite={() => onToggleFavorite(editor.userId)}
                />
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
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'var(--muted-foreground)', fontSize: 13 }}>
            Carregando pedidos...
          </div>
        ) : ordersError ? (
          <div style={{ background: 'var(--destructive-soft)', border: '1px solid var(--destructive-border)', borderRadius: 12, padding: 24, color: 'var(--destructive)', fontSize: 13, textAlign: 'center' }}>
            {ordersError}
          </div>
        ) : orders.length === 0 ? (
          <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: 12, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <IconBriefcase size={24} stroke={1.5} color="var(--brand)" />
            </div>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff', margin: '0 0 8px' }}>
              Sem pedidos ainda
            </h3>
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: '0 0 20px' }}>
              Escolha um editor e crie seu primeiro projeto.
            </p>
            <button
              onClick={() => changeSection('feed')}
              style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}
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

      {/* ── Minhas solicitações (marketplace invertido) ── */}
      {section === 'requests' && (
        <CreatorRequestsSection
          initialRequestId={searchParams.get('request')}
          onOpenOrder={(id) => navigate(`/orders/${id}`)}
          onOpenEditor={(id) => navigate(`/editors/${id}`)}
          onChanged={refreshRequestsBadge}
        />
      )}

      {/* ── Pagamentos ── */}
      {section === 'payments' && (
        <PaymentsSection
          onOpenOrder={(id) => navigate(`/orders/${id}`)}
          onBrowse={() => changeSection('feed')}
        />
      )}

      {/* ── Favoritos ── */}
      {section === 'favorites' && (
        <FavoritesSection
          onNavigate={navigate}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
        />
      )}

      {/* ── Minha conta ── */}
      {section === 'account' && <AccountSection />}
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
          ? accent ? 'var(--brand)' : 'var(--brand)'
          : 'var(--border)',
        color: active ? '#fff' : 'var(--foreground)',
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
  favorited,
  onToggleFavorite,
}: {
  editor: EditorListItem
  onNavigate: (path: string) => void
  favorited?: boolean
  onToggleFavorite?: () => void
}) {
  const minPrice = editor.portfolioPreview.length
    ? Math.min(...editor.portfolioPreview.map(p => p.basePrice))
    : null
  const thumbnail = editor.portfolioPreview[0]?.thumbnailUrl ?? null
  const avatarBg = avatarColor(editor.name)

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
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--brand-border)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* ── Thumbnail ── */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '16/10',
          background: 'var(--surface-raised)',
          backgroundImage:
            'repeating-linear-gradient(135deg, var(--surface-subtle) 0px, var(--surface-subtle) 1px, transparent 1px, transparent 20px)',
          overflow: 'hidden',
        }}
      >
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
            aria-label={favorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            title={favorited ? 'Remover dos favoritos' : 'Favoritar'}
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 2,
              width: 34, height: 34, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(13,27,42,0.55)', backdropFilter: 'blur(6px)',
              border: '1px solid var(--border)',
              color: favorited ? 'var(--destructive)' : '#fff',
              cursor: 'pointer', transition: 'transform 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.12)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            {favorited ? <IconHeartFilled size={17} /> : <IconHeart size={17} stroke={1.8} />}
          </button>
        )}
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
              background: 'var(--input)',
              border: '1.5px solid var(--muted-foreground)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)',
            }}
          >
            <IconPlayerPlay size={16} stroke={1.5} style={{ color: 'var(--foreground)', marginLeft: 2 }} />
          </div>
        </div>
        {/* Badge */}
        {badge && (
          <div
            style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(255,255,255,0.92)',
              color: 'var(--background)', fontSize: 11, fontWeight: 700,
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
            color: 'var(--muted-foreground)', textTransform: 'uppercase',
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
              background: avatarBg,
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
              {editor.verified && (
                <IconRosetteDiscountCheckFilled
                  size={13}
                  color="var(--brand)"
                  style={{ flexShrink: 0 }}
                  aria-label="Editor verificado"
                />
              )}
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1 }}>
              {editor.categories.slice(0, 3).map(c => c.name).join(' · ')}
            </p>
          </div>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            <IconStarFilled size={11} color="var(--brand)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Syne', sans-serif" }}>
              {editor.avgRating ? editor.avgRating.toFixed(1) : '—'}
            </span>
          </div>
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <span
            style={{
              fontSize: 11, color: 'var(--foreground)',
              background: 'var(--border)',
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
                fontSize: 10, color: 'var(--muted-foreground)',
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
              background: 'var(--brand)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 16px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Syne', sans-serif",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--brand)')}
          >
            Ver perfil
            <IconArrowRight size={14} stroke={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Favoritos ────────────────────────────────────────────────────────────────

function FavoritesSection({
  onNavigate,
  favoriteIds,
  onToggleFavorite,
}: {
  onNavigate: (path: string) => void
  favoriteIds: Set<string>
  onToggleFavorite: (editorUserId: string) => void
}) {
  const [editors, setEditors] = useState<FavoriteEditor[] | null>(null)

  useEffect(() => {
    listFavorites().then(setEditors).catch(() => setEditors([]))
  }, [])

  // Reflete remocoes feitas pelo coracao sem refazer a busca: some da lista na hora
  const visiveis = (editors ?? []).filter((e) => favoriteIds.has(e.userId))

  if (editors === null) return <SkeletonCards count={6} />

  if (visiveis.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface-subtle)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '64px 24px', textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 52, height: 52, borderRadius: '50%', margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--brand-soft)',
          }}
        >
          <IconHeart size={24} stroke={1.5} color="var(--brand)" />
        </div>
        <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff', margin: '0 0 8px' }}>
          Nenhum editor favoritado ainda
        </h3>
        <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: 0 }}>
          Toque no coracao de um editor na busca para salva-lo aqui e achar depois.
        </p>
      </div>
    )
  }

  return (
    <div
      className="anim-stagger"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 16,
      }}
    >
      {visiveis.map((editor) => (
        <EditorCard
          key={editor.id}
          editor={editor}
          onNavigate={onNavigate}
          favorited
          onToggleFavorite={() => onToggleFavorite(editor.userId)}
        />
      ))}
    </div>
  )
}

// ─── Minha conta ──────────────────────────────────────────────────────────────

function AccountSection() {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const dirtyProfile =
    name.trim() !== (user?.name ?? '') ||
    (bio ?? '') !== (user?.bio ?? '') ||
    avatarUrl !== (user?.avatarUrl ?? null)

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setProfileMsg(null)
    try {
      const result = await uploadFile(file, 'avatars', 'image')
      setAvatarUrl(result.secureUrl)
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : 'Erro no upload' })
    } finally {
      setUploading(false)
    }
  }

  async function saveProfile() {
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const updated = await updateMe({ name: name.trim(), bio: bio.trim() || null, avatarUrl })
      updateUser({ name: updated.name, bio: updated.bio, avatarUrl: updated.avatarUrl })
      setProfileMsg({ ok: true, text: 'Perfil atualizado.' })
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setProfileMsg({ ok: false, text: e?.response?.data?.message ?? 'Não foi possível salvar.' })
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    setSavingPwd(true)
    setPwdMsg(null)
    try {
      await changePassword(currentPassword, newPassword)
      setPwdMsg({ ok: true, text: 'Senha alterada.' })
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setPwdMsg({ ok: false, text: e?.response?.data?.message ?? 'Não foi possível alterar a senha.' })
    } finally {
      setSavingPwd(false)
    }
  }

  const card: React.CSSProperties = {
    background: 'var(--surface-subtle)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 24,
  }
  const label: React.CSSProperties = {
    display: 'block', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 6,
  }

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Perfil */}
      <div style={card}>
        <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff', margin: '0 0 18px' }}>
          Perfil
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <Avatar name={name || user?.name || '?'} url={avatarUrl} size={64} />
          <label
            style={{
              fontSize: 13, fontWeight: 600, cursor: uploading ? 'wait' : 'pointer',
              color: 'var(--brand)', padding: '8px 14px', borderRadius: 8,
              background: 'var(--brand-soft)', border: '1px solid var(--brand-border)',
            }}
          >
            {uploading ? 'Enviando…' : 'Trocar foto'}
            <input type="file" accept="image/*" onChange={onAvatar} disabled={uploading} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Email</label>
          <input value={user?.email ?? ''} disabled className="input-field" style={{ opacity: 0.6, cursor: 'not-allowed' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>Bio</label>
          <textarea
            value={bio ?? ''}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Conte um pouco sobre você e seu conteúdo…"
            className="input-field"
            style={{ resize: 'vertical', minHeight: 72, paddingTop: 10 }}
          />
        </div>

        {profileMsg && (
          <p style={{ fontSize: 12, margin: '0 0 12px', color: profileMsg.ok ? 'var(--success)' : 'var(--destructive)' }}>
            {profileMsg.text}
          </p>
        )}
        <button
          onClick={saveProfile}
          disabled={!dirtyProfile || savingProfile || uploading}
          className="btn-primary"
          style={{ width: 'auto', padding: '0 20px', opacity: !dirtyProfile || savingProfile ? 0.6 : 1 }}
        >
          {savingProfile ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>

      {/* Senha */}
      <div style={card}>
        <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff', margin: '0 0 18px' }}>
          Senha
        </h3>
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Senha atual</label>
          <input
            type={showPwd ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input-field"
          />
        </div>
        <div style={{ marginBottom: 8, position: 'relative' }}>
          <label style={label}>Nova senha</label>
          <input
            type={showPwd ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Entre 8 e 72 caracteres"
            maxLength={72}
            className="input-field pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
            style={{ position: 'absolute', right: 8, top: 32, background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}
          >
            {showPwd ? <IconEyeOff size={16} stroke={1.5} /> : <IconEye size={16} stroke={1.5} />}
          </button>
        </div>

        {pwdMsg && (
          <p style={{ fontSize: 12, margin: '8px 0 12px', color: pwdMsg.ok ? 'var(--success)' : 'var(--destructive)' }}>
            {pwdMsg.text}
          </p>
        )}
        <button
          onClick={savePassword}
          disabled={!currentPassword || newPassword.length < 8 || savingPwd}
          className="btn-primary"
          style={{ width: 'auto', padding: '0 20px', marginTop: 8, opacity: !currentPassword || newPassword.length < 8 || savingPwd ? 0.6 : 1 }}
        >
          {savingPwd ? 'Alterando…' : 'Alterar senha'}
        </button>
      </div>
    </div>
  )
}


// ─── Pagamentos ───────────────────────────────────────────────────────────────

const TX_COLORS: Record<TransactionStatus, string> = {
  PENDING: 'var(--brand)',
  HELD: '#3B82F6',
  RELEASED: 'var(--success)',
  REFUNDED: 'var(--destructive)',
}


function PaymentsSection({
  onOpenOrder,
  onBrowse,
}: {
  onOpenOrder: (orderId: string) => void
  onBrowse: () => void
}) {
  const [payments, setPayments] = useState<MyPayment[]>([])
  const [summary, setSummary] = useState<PaymentsSummary | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getMyPayments(page)
      .then((res) => {
        if (!alive) return
        setPayments(res.payments)
        setSummary(res.summary)
        setTotalPages(res.totalPages)
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page])

  const cards = [
    { label: 'Total pago', value: summary?.totalPaid ?? 0, Icon: IconCreditCard, color: 'var(--brand)' },
    { label: 'Em custódia (escrow)', value: summary?.totalHeld ?? 0, Icon: IconLock, color: '#3B82F6' },
    { label: 'Total concluído', value: summary?.totalCompleted ?? 0, Icon: IconCircleCheck, color: 'var(--success)' },
  ]

  if (loading && payments.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <IconLoader2 size={26} className="animate-spin" style={{ color: 'var(--brand)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-[12px] p-5"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{c.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${c.color}1A` }}>
                <c.Icon size={16} stroke={1.5} color={c.color} />
              </span>
            </div>
            <p className="font-heading text-2xl font-bold text-white">{money(c.value)}</p>
          </div>
        ))}
      </div>

      {/* Lista de pagamentos */}
      {payments.length === 0 ? (
        <div
          className="rounded-[12px] p-12 text-center"
          style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--brand-soft)' }}>
            <IconCreditCard size={28} stroke={1.5} color="var(--brand)" />
          </div>
          <h3 className="font-heading text-lg font-bold text-white">Você ainda não fez nenhum pagamento</h3>
          <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Contrate um editor e o pagamento ficará registrado aqui, protegido em custódia até você aprovar a entrega.
          </p>
          <button
            onClick={onBrowse}
            className="mt-6 inline-flex items-center gap-2 rounded-[8px] px-5 py-2.5 text-sm font-semibold"
            style={{ background: 'var(--brand)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}
          >
            <IconSearch size={15} stroke={2} />
            Explorar editores
          </button>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-[12px]"
          style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
        >
          {/* Cabeçalho */}
          <div
            className="grid grid-cols-[2fr_1.2fr_1fr_1.3fr_1fr] gap-4 px-5 py-3 text-xs font-medium"
            style={{ color: 'var(--muted-foreground)', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)' }}
          >
            <span>Projeto</span>
            <span>Editor</span>
            <span>Valor</span>
            <span>Status</span>
            <span>Data</span>
          </div>

          {payments.map((p) => {
            const color = TX_COLORS[p.status]
            return (
              <button
                key={p.id}
                onClick={() => onOpenOrder(p.order.id)}
                className="grid w-full grid-cols-[2fr_1.2fr_1fr_1.3fr_1fr] items-center gap-4 px-5 py-3.5 text-left text-sm transition-colors"
                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--surface-subtle)', cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-subtle)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span className="truncate">
                  <span className="font-medium text-white">{p.order.title}</span>
                  <span className="ml-2 text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{p.order.categoryName}</span>
                </span>
                <span className="truncate" style={{ color: 'var(--foreground)' }}>{p.order.editorName}</span>
                <span className="font-heading font-semibold text-white">{money(p.amount)}</span>
                <span>
                  <span
                    className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ background: `${color}1A`, color, border: `1px solid ${color}33` }}
                  >
                    {TRANSACTION_LABELS[p.status]}
                  </span>
                </span>
                <span style={{ color: 'var(--muted-foreground)' }}>
                  {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </button>
            )
          })}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Página {page} de {totalPages}</span>
              <div className="flex gap-2">
                <button aria-label="Página anterior"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px]"
                  style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', color: page <= 1 ? 'var(--muted-foreground)' : 'var(--foreground)', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  <IconChevronLeft size={15} stroke={1.5} />
                </button>
                <button aria-label="Próxima página"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px]"
                  style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', color: page >= totalPages ? 'var(--muted-foreground)' : 'var(--foreground)', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
                >
                  <IconChevronRight size={15} stroke={1.5} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
