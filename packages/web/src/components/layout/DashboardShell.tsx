import { relativeDate } from '@/lib/format'
import { useNavigate, useLocation } from 'react-router-dom'
import { limparCache } from '@/lib/cache'
import { exitPersona, inPersona } from '@/lib/persona'
import { useState, useEffect, useRef } from 'react'
import {
  IconLogout, IconBell, IconCheck, IconPackage, IconMessage2, IconTruck,
  IconCoin, IconX, IconAlertCircle,
  IconSend, IconFileText, IconGavel,
} from '@tabler/icons-react'
import type { AuthUser } from '@/hooks/use-auth'
import { CMCutLogo } from '@/components/ui/CMLogo'
import { fetchNotifications, markAllRead, markOneRead, type NotificationDTO } from '@/lib/notifications'

const SIDEBAR_COLLAPSED_KEY = 'cm_sidebar_collapsed'

export interface NavItem {
  id: string
  label: string
  Icon: React.ElementType
  badge?: string
}

interface Props {
  badgeLabel?: string
  navLabel?: string
  navItems: NavItem[]
  activeId: string
  onNavigate: (id: string) => void
  user: AuthUser
  pageTitle: string
  pageSubtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  banner?: React.ReactNode
  /** Chamado ao clicar no bloco de perfil (avatar/nome) da sidebar */
  onProfileClick?: () => void
}

const NOTIF_ICONS: Record<string, React.ElementType> = {
  NEW_ORDER: IconPackage,
  NEW_MESSAGE: IconMessage2,
  DELIVERY_RECEIVED: IconTruck,
  PAYMENT_RELEASED: IconCoin,
  PAYMENT_CONFIRMED: IconCoin,
  ORDER_ACCEPTED: IconCheck,
  ORDER_CANCELLED: IconX,
  REVISION_REQUESTED: IconAlertCircle,
  PROPOSAL_RECEIVED: IconAlertCircle,
  PROPOSAL_ACCEPTED: IconCheck,
  PROPOSAL_REJECTED: IconX,
  CONTRACT_ACCEPTED: IconFileText,
  DISPUTE_OPENED: IconGavel,
  DISPUTE_RESOLVED: IconGavel,
  REQUEST_PROPOSAL_RECEIVED: IconSend,
  REQUEST_PROPOSAL_ACCEPTED: IconCheck,
  REQUEST_PROPOSAL_REJECTED: IconX,
}

/** Destino de cada notificação ao ser clicada */
function notificationTarget(n: NotificationDTO): string | null {
  if (n.relatedOrderId) return `/orders/${n.relatedOrderId}`
  if (n.relatedRequestId) {
    if (n.type === 'REQUEST_PROPOSAL_RECEIVED') {
      return `/dashboard/creator?section=requests&request=${n.relatedRequestId}`
    }
    // Proposta recusada / solicitação cancelada → histórico do editor
    return '/dashboard/editor?section=my-proposals'
  }
  return null
}


function NotificationBell({ onNavigateTo }: { onNavigateTo: (path: string) => void }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationDTO[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      const data = await fetchNotifications()
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {}
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 20000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleMarkAllRead() {
    await markAllRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    setUnreadCount(0)
  }

  async function handleClickNotif(notif: NotificationDTO) {
    if (!notif.readAt) {
      await markOneRead(notif.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    setOpen(false)
    const target = notificationTarget(notif)
    if (target) onNavigateTo(target)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors"
        style={{
          background: open ? 'var(--brand-soft)' : 'var(--surface-subtle)',
          border: `1px solid ${open ? 'var(--brand-border)' : 'var(--border)'}`,
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <IconBell size={16} stroke={1.5} style={{ color: open ? 'var(--brand)' : 'var(--foreground)' }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: 'var(--brand)',
              color: 'white',
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              fontFamily: "var(--font-heading)",
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 340,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white', fontFamily: "var(--font-heading)" }}>
              Notificações {unreadCount > 0 && <span style={{ color: 'var(--brand)' }}>({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  fontSize: 11,
                  color: 'var(--brand)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "var(--font-body)",
                  padding: 0,
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--muted-foreground)',
                  fontSize: 13,
                }}
              >
                Nenhuma notificação
              </div>
            ) : (
              notifications.map((notif) => {
                const Icon = NOTIF_ICONS[notif.type] ?? IconBell
                const isUnread = !notif.readAt
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClickNotif(notif)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '12px 16px',
                      width: '100%',
                      background: isUnread ? 'var(--brand-soft)' : 'transparent',
                      borderLeft: isUnread ? '2px solid var(--brand)' : '2px solid transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--surface-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-subtle)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isUnread ? 'var(--brand-soft)' : 'transparent' }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: isUnread ? 'var(--brand-soft)' : 'var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={14} stroke={1.5} color={isUnread ? 'var(--brand)' : 'var(--muted-foreground)'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: isUnread ? 600 : 400, color: isUnread ? 'white' : 'var(--foreground)', margin: '0 0 2px', lineHeight: 1.3 }}>
                        {notif.title}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {notif.body}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0, marginTop: 2 }}>
                      {relativeDate(notif.createdAt)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardShell({
  badgeLabel,
  navLabel,
  navItems,
  activeId,
  onNavigate,
  user,
  pageTitle,
  pageSubtitle,
  actions,
  banner,
  children,
  onProfileClick,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1',
  )

  const [cutting, setCutting] = useState(false)

  function applyCollapsed() {
    setCollapsed((v) => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? '0' : '1')
      return !v
    })
  }

  // Clique na marca: o ícone é "cortado" (ver .cm-cut) e o menu troca no meio do gesto.
  // Sem animação (prefers-reduced-motion) ou durante uma já em curso, o comportamento é direto.
  function toggleCollapsed() {
    if (cutting) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyCollapsed()
      return
    }
    setCutting(true)
    window.setTimeout(applyCollapsed, 280)
    window.setTimeout(() => setCutting(false), 640)
  }

  // Admin dentro de uma persona (criador/editor distintos da conta dele): aviso fixo com caminho de volta
  const viewingAs = inPersona() ? (user.role === 'CREATOR' ? 'criador' : user.role === 'EDITOR' ? 'editor' : null) : null

  // Guarda a rolagem ao sair (ex.: abrir o perfil de um editor) e devolve ao voltar
  const scrollKey = `cm_scroll:${location.pathname}${location.search}`
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    let saved = 0
    try { saved = Number(sessionStorage.getItem(scrollKey)) || 0 } catch { /* sem storage */ }
    if (saved > 0) {
      // o conteúdo pode chegar depois (fetch): tenta algumas vezes até caber
      let tries = 0
      const t = window.setInterval(() => {
        el.scrollTop = saved
        if (el.scrollTop >= saved - 2 || ++tries > 12) window.clearInterval(t)
      }, 80)
      return () => {
        window.clearInterval(t)
        try { sessionStorage.setItem(scrollKey, String(el.scrollTop)) } catch { /* sem storage */ }
      }
    }
    return () => {
      try { sessionStorage.setItem(scrollKey, String(el.scrollTop)) } catch { /* sem storage */ }
    }
  }, [scrollKey])

  function logout() {
    localStorage.clear()
    // Sem isto o cache em memoria sobrevive ao logout e o proximo usuario a
    // logar nesta aba veria dados do anterior ate o TTL expirar
    limparCache()
    navigate('/login')
  }

  function goTo(path: string) {
    navigate(path)
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      {viewingAs && (
        <div
          role="status"
          className="anim-fade-up fixed left-1/2 top-5 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full py-2 pl-5 pr-2 shadow-lg"
          style={{
            background: 'color-mix(in oklab, var(--brand) 18%, transparent)',
            border: '1px solid var(--brand-border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            Visualizando como <strong style={{ color: 'var(--brand)' }}>{viewingAs}</strong>
          </span>
          <button
            type="button"
            onClick={exitPersona}
            className="hover-surface rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)', color: 'var(--foreground)', cursor: 'pointer' }}
          >
            Voltar para admin
          </button>
        </div>
      )}
      {/* ── Sidebar ── */}
      <aside
        className={`flex ${collapsed ? 'w-[68px]' : 'w-64'} shrink-0 flex-col`}
        style={{
          background: 'var(--card)',
          borderRight: '1px solid var(--border)',
          height: '100dvh',
          position: 'sticky',
          top: 0,
          transition: 'width 0.2s ease',
        }}
      >
        {/* Marca (clicável: recolhe/expande o menu) + badge */}
        <div
          className={`flex items-center gap-2.5 py-4 ${collapsed ? 'justify-center px-2' : 'px-5'}`}
          style={{ borderBottom: '1px solid var(--border)', minHeight: 69 }}
        >
          <CMCutLogo
            size={32}
            cutting={cutting}
            onClick={toggleCollapsed}
            expanded={!collapsed}
            label={collapsed ? 'Expandir menu' : 'Reduzir menu'}
          />
          {!collapsed && (
            <>
              <span
                className="anim-fade"
                style={{
                  fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 17,
                  letterSpacing: '-0.02em', color: 'var(--foreground)', whiteSpace: 'nowrap',
                }}
              >
                Cut<span style={{ fontWeight: 500 }}>Makers</span>
              </span>
              {badgeLabel && (
                <span
                  className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: 'var(--brand-soft)',
                    color: 'var(--brand)',
                    fontFamily: 'var(--font-heading)',
                  }}
                >
                  {badgeLabel}
                </span>
              )}
            </>
          )}
        </div>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
          {navLabel && !collapsed && (
            <p
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
                padding: '0 12px', marginBottom: 8,
                fontFamily: "var(--font-heading)",
              }}
            >
              {navLabel}
            </p>
          )}
          {navItems.map(({ id, label, Icon, badge }) => {
            const active = activeId === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                title={collapsed ? label : undefined}
                className={`mb-1 flex w-full items-center gap-3 rounded-[8px] py-2.5 text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'}`}
                style={{
                  background: active ? 'var(--brand)' : 'transparent',
                  color: active ? 'var(--foreground)' : 'var(--foreground)',
                  border: '1px solid transparent',
                  fontFamily: "var(--font-body)",
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                <Icon size={collapsed ? 18 : 16} stroke={1.5} />
                {!collapsed && <span className="flex-1">{label}</span>}
                {badge && !collapsed && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: 'var(--brand-border)', color: 'var(--brand)' }}
                  >
                    {badge}
                  </span>
                )}
                {badge && collapsed && (
                  <span
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 7, height: 7, borderRadius: '50%',
                      background: 'var(--brand)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer: perfil (clicável) + logout */}
        <div className={`py-4 ${collapsed ? 'px-2' : 'px-3'}`} style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onProfileClick}
            title="Meu perfil"
            disabled={!onProfileClick}
            className={`mb-2 flex w-full items-center gap-3 rounded-[8px] py-2 transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'}`}
            style={{
              background: 'none',
              border: '1px solid transparent',
              cursor: onProfileClick ? 'pointer' : 'default',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              if (onProfileClick) {
                e.currentTarget.style.background = 'var(--surface-subtle)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-xs font-bold text-white"
              style={{ background: 'var(--brand)' }}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                user.name?.charAt(0).toUpperCase()
              )}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user.name}</p>
                <p className="truncate text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
                  {onProfileClick ? 'Ver perfil' : user.email}
                </p>
              </div>
            )}
          </button>
          <button
            onClick={logout}
            title="Sair"
            className={`flex w-full items-center gap-3 rounded-[8px] py-2.5 text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'px-3'}`}
            style={{
              color: 'var(--muted-foreground)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "var(--font-body)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--destructive)'
              e.currentTarget.style.background = 'var(--destructive-soft)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--muted-foreground)'
              e.currentTarget.style.background = 'none'
            }}
          >
            <IconLogout size={16} stroke={1.5} />
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      {/* ── Conteúdo ── */}
      <div className="flex flex-1 flex-col">
        {banner}

        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h1 className="font-heading text-lg font-bold text-white">{pageTitle}</h1>
            {pageSubtitle && (
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {pageSubtitle}
              </p>
            )}
          </div>
          {/* Header enxuto: ações contextuais da página + apenas o sino de notificações */}
          <div className="flex items-center gap-3">
            {actions}
            <NotificationBell onNavigateTo={goTo} />
          </div>
        </header>

        <main ref={mainRef} className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
