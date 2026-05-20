import { useNavigate } from 'react-router-dom'
import { IconLogout, IconBell } from '@tabler/icons-react'
import type { AuthUser } from '@/hooks/use-auth'

export interface NavItem {
  id: string
  label: string
  Icon: React.ElementType
  badge?: string
}

interface Props {
  // sidebar
  badgeLabel?: string // "EDITOR" | "CREATOR" | ...
  navItems: NavItem[]
  activeId: string
  onNavigate: (id: string) => void
  user: AuthUser
  // header
  pageTitle: string
  pageSubtitle?: string
  actions?: React.ReactNode
  // content
  children: React.ReactNode
  // banner (opcional)
  banner?: React.ReactNode
}

/**
 * Shell genérico para dashboards (Editor/Creator).
 * Mesma estrutura visual do AdminPage, mas reutilizável.
 */
export function DashboardShell({
  badgeLabel,
  navItems,
  activeId,
  onNavigate,
  user,
  pageTitle,
  pageSubtitle,
  actions,
  banner,
  children,
}: Props) {
  const navigate = useNavigate()

  function logout() {
    localStorage.clear()
    navigate('/login')
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
        {/* Logo + badge */}
        <div
          className="flex items-center gap-2 px-6 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: '#F4631E' }} />
          <span
            className="font-heading text-[18px] font-extrabold text-white"
          >
            CutMakers
          </span>
          {badgeLabel && (
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: 'rgba(244,99,30,0.15)',
                color: '#F4631E',
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {badgeLabel}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navItems.map(({ id, label, Icon, badge }) => {
            const active = activeId === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
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
                <span className="flex-1">{label}</span>
                {badge && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'rgba(244,99,30,0.2)', color: '#F4631E' }}
                  >
                    {badge}
                  </span>
                )}
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
                {user.email}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm transition-colors"
            style={{
              color: 'rgba(255,255,255,0.4)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#EF4444'
              e.currentTarget.style.background = 'rgba(239,68,68,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
              e.currentTarget.style.background = 'none'
            }}
          >
            <IconLogout size={16} stroke={1.5} />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Conteúdo ── */}
      <div className="flex flex-1 flex-col">
        {banner}

        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <h1 className="font-heading text-lg font-bold text-white">{pageTitle}</h1>
            {pageSubtitle && (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {pageSubtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <button
              className="flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
              }}
            >
              <IconBell size={16} stroke={1.5} style={{ color: 'rgba(255,255,255,0.6)' }} />
            </button>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full font-heading text-sm font-bold text-white"
              style={{ background: '#F4631E' }}
            >
              {user.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
