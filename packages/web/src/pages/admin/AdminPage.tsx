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
  IconArrowLeft,
  IconTrendingUp,
  IconCheck,
  IconClock,
  IconAlertTriangle,
  IconDots,
  IconSearch,
  IconBell,
  IconChevronRight,
} from '@tabler/icons-react'

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ViewMode = 'ADMIN' | 'CREATOR' | 'EDITOR'
type AdminSection = 'dashboard' | 'users' | 'orders' | 'transactions' | 'subscriptions'

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

function UsersSection() {
  return (
    <div
      className="rounded-card p-6"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="mb-6 flex items-center justify-between">
        <SectionHeader title="Usuários" />
        <div
          className="flex items-center gap-2 rounded-[8px] px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <IconSearch size={14} stroke={1.5} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <input
            placeholder="Buscar usuário..."
            className="bg-transparent text-xs text-white outline-none placeholder:text-white/40 w-40"
          />
        </div>
      </div>

      {/* Cabeçalho da tabela */}
      <div
        className="mb-2 grid grid-cols-5 gap-4 rounded-[8px] px-4 py-2 text-xs font-medium"
        style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}
      >
        <span>Nome</span>
        <span>Email</span>
        <span>Role</span>
        <span>Cadastro</span>
        <span>Ações</span>
      </div>

      <EmptyState message="Nenhum usuário cadastrado ainda" />
    </div>
  )
}

function OrdersSection() {
  const statusColors: Record<string, string> = {
    PENDING: '#F4631E',
    IN_PROGRESS: '#3B82F6',
    COMPLETED: '#22C55E',
    CANCELLED: '#EF4444',
    DISPUTED: '#EAB308',
  }

  return (
    <div
      className="rounded-card p-6"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SectionHeader title="Pedidos" />
        {['Todos', 'Pendentes', 'Em andamento', 'Concluídos', 'Cancelados'].map((f) => (
          <button
            key={f}
            className="rounded-full px-3 py-1 text-xs transition-colors"
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
        className="mb-2 grid grid-cols-6 gap-4 rounded-[8px] px-4 py-2 text-xs font-medium"
        style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}
      >
        <span>Título</span>
        <span>Creator</span>
        <span>Editor</span>
        <span>Valor</span>
        <span>Status</span>
        <span>Data</span>
      </div>

      <EmptyState message="Nenhum pedido criado ainda" />
    </div>
  )
}

function TransactionsSection() {
  return (
    <div
      className="rounded-card p-6"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <SectionHeader title="Transações" />

      <div
        className="mb-2 grid grid-cols-5 gap-4 rounded-[8px] px-4 py-2 text-xs font-medium"
        style={{ color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)' }}
      >
        <span>ID</span>
        <span>Pagador</span>
        <span>Valor</span>
        <span>Status</span>
        <span>Data</span>
      </div>

      <EmptyState message="Nenhuma transação registrada ainda" />
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

// ─── Creator & Editor views (simulação) ──────────────────────────────────────

function CreatorView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-white">Feed de Editores</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Encontre o editor perfeito para o seu projeto
          </p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '0 20px' }}>
          + Nova Ordem
        </button>
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

      {/* Grid de editores (empty state) */}
      <div
        className="rounded-card p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <EmptyState message="Editores disponíveis aparecerão aqui — Fase 2" />
      </div>

      {/* Meus pedidos */}
      <div
        className="rounded-card p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <SectionHeader title="Meus Pedidos Recentes" />
        <EmptyState message="Seus pedidos aparecerão aqui" />
      </div>
    </div>
  )
}

function EditorView() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold text-white">Dashboard do Editor</h2>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Gerencie seus pedidos e portfólio
          </p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '0 20px' }}>
          + Adicionar Projeto
        </button>
      </div>

      {/* Stats do editor */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pedidos Ativos', value: '0', icon: IconClock },
          { label: 'Concluídos', value: '0', icon: IconCheck },
          { label: 'Avaliação Média', value: '—', icon: IconTrendingUp },
        ].map((s) => (
          <StatsCard key={s.label} label={s.label} value={s.value} delta="" Icon={s.icon} />
        ))}
      </div>

      {/* Pedidos recebidos */}
      <div
        className="rounded-card p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <SectionHeader title="Pedidos Recebidos" />
        <EmptyState message="Pedidos de criadores aparecerão aqui" />
      </div>

      {/* Portfólio */}
      <div
        className="rounded-card p-6"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <SectionHeader title="Meu Portfólio" />
        <EmptyState message="Adicione projetos ao seu portfólio — Fase 2" />
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: AdminSection; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: IconLayoutDashboard },
  { id: 'users', label: 'Usuários', Icon: IconUsers },
  { id: 'orders', label: 'Pedidos', Icon: IconBriefcase },
  { id: 'transactions', label: 'Transações', Icon: IconCreditCard },
  { id: 'subscriptions', label: 'Assinaturas', Icon: IconCrown },
]

// ─── Página principal ─────────────────────────────────────────────────────────

export function AdminPage() {
  const navigate = useNavigate()
  const [section, setSection] = useState<AdminSection>('dashboard')
  const [viewMode, setViewMode] = useState<ViewMode>('ADMIN')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

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
    orders: 'Pedidos',
    transactions: 'Transações',
    subscriptions: 'Assinaturas',
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#0D1B2A' }}>
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
            ADMIN
          </span>
        </div>

        {/* Nav principal */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Gerenciamento
          </p>
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = viewMode === 'ADMIN' && section === id
            return (
              <button
                key={id}
                onClick={() => { setViewMode('ADMIN'); setSection(id) }}
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
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Administrador</p>
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

        {/* Banner de modo de visualização */}
        {viewMode !== 'ADMIN' && (
          <div
            className="flex items-center justify-between px-6 py-2.5"
            style={{ background: 'rgba(244,99,30,0.1)', borderBottom: '1px solid rgba(244,99,30,0.2)' }}
          >
            <div className="flex items-center gap-2">
              {viewMode === 'CREATOR' ? <IconCamera size={14} color="#F4631E" stroke={1.5} /> : <IconMovie size={14} color="#F4631E" stroke={1.5} />}
              <span className="text-xs" style={{ color: '#F4631E' }}>
                Visualizando como <strong>{viewMode === 'CREATOR' ? 'Creator' : 'Editor'}</strong> — modo de administrador
              </span>
            </div>
            <button
              onClick={() => setViewMode('ADMIN')}
              className="flex items-center gap-1 rounded-[6px] px-2 py-1 text-xs transition-colors"
              style={{ color: '#F4631E', background: 'rgba(244,99,30,0.15)', border: 'none', cursor: 'pointer' }}
            >
              <IconArrowLeft size={12} stroke={1.5} />
              Voltar ao Admin
            </button>
          </div>
        )}

        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <h1 className="font-heading text-lg font-bold text-white">
              {viewMode === 'ADMIN' ? sectionTitles[section] : viewMode === 'CREATOR' ? 'Dashboard Creator' : 'Dashboard Editor'}
            </h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {viewMode === 'ADMIN' ? 'Painel de administração' : `Visualização de ${viewMode.toLowerCase()}`}
            </p>
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
                    onClick={() => { setViewMode('CREATOR'); setProfileMenuOpen(false) }}
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
                    onClick={() => { setViewMode('EDITOR'); setProfileMenuOpen(false) }}
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
              {section === 'users' && <UsersSection />}
              {section === 'orders' && <OrdersSection />}
              {section === 'transactions' && <TransactionsSection />}
              {section === 'subscriptions' && <SubscriptionsSection />}
            </>
          )}
          {viewMode === 'CREATOR' && <CreatorView />}
          {viewMode === 'EDITOR' && <EditorView />}
        </main>
      </div>
    </div>
  )
}
