import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  IconLogout, IconBell, IconCheck, IconPackage, IconMessage2, IconTruck,
  IconCoin, IconX, IconAlertCircle, IconChevronsLeft, IconChevronsRight,
} from '@tabler/icons-react'
import type { AuthUser } from '@/hooks/use-auth'
import { CMLogo, CMLockup } from '@/components/ui/CMLogo'
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
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function NotificationBell({ onNavigateToOrder }: { onNavigateToOrder: (id: string) => void }) {
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
    if (notif.relatedOrderId) onNavigateToOrder(notif.relatedOrderId)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-[8px] transition-colors"
        style={{
          background: open ? 'rgba(244,99,30,0.12)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(244,99,30,0.3)' : 'rgba(255,255,255,0.08)'}`,
          cursor: 'pointer',
          position: 'relative',
        }}
      >
        <IconBell size={16} stroke={1.5} style={{ color: open ? '#F4631E' : 'rgba(255,255,255,0.6)' }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: '#F4631E',
              color: 'white',
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 3px',
              fontFamily: "'Syne', sans-serif",
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
            background: '#162436',
            border: '1px solid rgba(255,255,255,0.08)',
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
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'white', fontFamily: "'Syne', sans-serif" }}>
              Notificações {unreadCount > 0 && <span style={{ color: '#F4631E' }}>({unreadCount})</span>}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  fontSize: 11,
                  color: '#F4631E',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
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
                  color: 'rgba(255,255,255,0.3)',
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
                      background: isUnread ? 'rgba(244,99,30,0.05)' : 'transparent',
                      borderLeft: isUnread ? '2px solid #F4631E' : '2px solid transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isUnread ? 'rgba(244,99,30,0.05)' : 'transparent' }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        background: isUnread ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={14} stroke={1.5} color={isUnread ? '#F4631E' : 'rgba(255,255,255,0.4)'} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: isUnread ? 600 : 400, color: isUnread ? 'white' : 'rgba(255,255,255,0.7)', margin: '0 0 2px', lineHeight: 1.3 }}>
                        {notif.title}
                      </p>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {notif.body}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0, marginTop: 2 }}>
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
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1',
  )

  function toggleCollapsed() {
    setCollapsed((v) => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? '0' : '1')
      return !v
    })
  }

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  function goToOrder(orderId: string) {
    navigate(`/orders/${orderId}`)
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#0D1B2A' }}>
      {/* ── Sidebar ── */}
      <aside
        className={`flex ${collapsed ? 'w-[68px]' : 'w-64'} shrink-0 flex-col`}
        style={{
          background: '#162436',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          height: '100vh',
          position: 'sticky',
          top: 0,
          transition: 'width 0.2s ease',
        }}
      >
        {/* Logo + badge + toggle */}
        <div
          className={`flex items-center gap-2 py-4 ${collapsed ? 'justify-center px-2' : 'px-5'}`}
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {collapsed ? (
            <CMLogo size={30} variant="orange" />
          ) : (
            <>
              <CMLockup size={30} wordSize={16} color="#FFFFFF" variant="orange" gap={8} />
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
            </>
          )}
        </div>

        {/* Toggle de colapso */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Expandir menu' : 'Reduzir menu'}
          aria-label={collapsed ? 'Expandir menu' : 'Reduzir menu'}
          className={`mx-3 mt-3 flex items-center gap-3 rounded-[8px] px-3 py-2 text-xs transition-colors ${collapsed ? 'justify-center' : ''}`}
          style={{
            color: 'rgba(255,255,255,0.35)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
        >
          {collapsed ? <IconChevronsRight size={15} stroke={1.5} /> : <IconChevronsLeft size={15} stroke={1.5} />}
          {!collapsed && 'Reduzir menu'}
        </button>

        {/* Nav */}
        <nav className={`flex-1 overflow-y-auto py-4 ${collapsed ? 'px-2' : 'px-3'}`}>
          {navLabel && !collapsed && (
            <p
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)',
                padding: '0 12px', marginBottom: 8,
                fontFamily: "'Syne', sans-serif",
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
                  background: active ? '#F4631E' : 'transparent',
                  color: active ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                  border: '1px solid transparent',
                  fontFamily: "'DM Sans', sans-serif",
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
                    style={{ background: 'rgba(244,99,30,0.2)', color: '#F4631E' }}
                  >
                    {badge}
                  </span>
                )}
                {badge && collapsed && (
                  <span
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#F4631E',
                    }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer: perfil (clicável) + logout */}
        <div className={`py-4 ${collapsed ? 'px-2' : 'px-3'}`} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-xs font-bold text-white"
              style={{ background: '#F4631E' }}
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
                <p className="truncate text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
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
            {!collapsed && 'Sair'}
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
          {/* Header enxuto: ações contextuais da página + apenas o sino de notificações */}
          <div className="flex items-center gap-3">
            {actions}
            <NotificationBell onNavigateToOrder={goToOrder} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
