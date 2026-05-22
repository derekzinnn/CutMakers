import { useState, useEffect } from 'react'
import { IconMessage2, IconLoader2 } from '@tabler/icons-react'
import { listConversations, type ConversationDTO } from '@/lib/conversations'
import { useAuth } from '@/hooks/use-auth'
import { ChatPanel } from './ChatPanel'

const AVATAR_PALETTE = ['#F4631E', '#3B82F6', '#A855F7', '#22C55E', '#EAB308', '#EC4899', '#14B8A6']

function nameHash(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function ConvAvatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  const bg = AVATAR_PALETTE[nameHash(name) % AVATAR_PALETTE.length]
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: size * 0.35,
        fontWeight: 700,
        color: 'white',
        fontFamily: "'Syne', sans-serif",
      }}
    >
      {initials(name)}
    </div>
  )
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

export function MessagesTab() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<ConversationDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ConversationDTO | null>(null)

  useEffect(() => {
    listConversations()
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function getOtherParty(conv: ConversationDTO) {
    return user?.id === conv.creator.id ? conv.editor : conv.creator
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <IconLoader2 size={24} stroke={1.5} color="#F4631E" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 32px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(244,99,30,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <IconMessage2 size={28} stroke={1.5} color="#F4631E" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: '0 0 8px', fontFamily: "'Syne', sans-serif" }}>
          Nenhuma conversa
        </h3>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: 0, maxWidth: 320 }}>
          As conversas aparecem aqui quando um pedido for criado.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 180px)',
        minHeight: 480,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Conversation list — always visible */}
      <div
        style={{
          width: 300,
          flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.08)',
          background: '#162436',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', margin: 0, fontFamily: "'Syne', sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Conversas
          </h3>
        </div>
        {conversations.map((conv) => {
          const other = getOtherParty(conv)
          const isSelected = selected?.id === conv.id
          return (
            <button
              key={conv.id}
              onClick={() => setSelected(conv)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: isSelected ? 'rgba(244,99,30,0.08)' : 'transparent',
                border: 'none',
                borderLeft: isSelected ? '3px solid #F4631E' : '3px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'background 0.15s',
              }}
            >
              <ConvAvatar name={other.name} avatarUrl={other.avatarUrl} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {other.name}
                  </span>
                  {conv.lastMessage && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginLeft: 8 }}>
                      {relativeDate(conv.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.order?.title ?? 'Conversa direta'}
                </p>
                {conv.lastMessage && (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.lastMessage.content}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selected ? (
          <>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: '#162436',
                flexShrink: 0,
              }}
            >
              <ConvAvatar name={getOtherParty(selected).name} avatarUrl={getOtherParty(selected).avatarUrl} size={32} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'white', margin: 0 }}>{getOtherParty(selected).name}</p>
                {selected.order && (
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{selected.order.title}</p>
                )}
              </div>
            </div>
            <ChatPanel conversation={selected} compact={false} />
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 14,
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <IconMessage2 size={32} stroke={1.5} />
            Selecione uma conversa
          </div>
        )}
      </div>
    </div>
  )
}
