import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconMessage2, IconLoader2, IconExternalLink } from '@tabler/icons-react'
import { listConversations, type ConversationDTO } from '@/lib/conversations'
import { useAuth } from '@/hooks/use-auth'
import { ChatPanel } from './ChatPanel'

// Paleta CATEGORICA de identidade (avatar por usuario): precisa de matizes
// DISTINTOS entre si, entao fica fora dos tokens do tema. Os chart-* do
// preset sao todos laranja/ambar — usa-los deixaria todo avatar igual.
const AVATAR_PALETTE = ['var(--brand)', '#3B82F6', '#A855F7', '#22C55E', '#EAB308', '#EC4899', '#14B8A6']

function nameHash(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}
function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function Avatar({ name, avatarUrl, size = 36 }: { name: string; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    )
  }
  const bg = AVATAR_PALETTE[nameHash(name) % AVATAR_PALETTE.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, fontSize: size * 0.35, fontWeight: 700,
      color: 'white', fontFamily: "'Syne', sans-serif",
    }}>
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
  return `${Math.floor(hrs / 24)}d`
}

interface PersonGroup {
  personId: string
  personName: string
  personAvatar: string | null
  conversations: ConversationDTO[]
  latestMessage: string | null
  latestTime: string | null
}

export function MessagesTab() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<ConversationDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)

  useEffect(() => {
    listConversations()
      .then((data) => {
        setConversations(data)
        if (data.length > 0) {
          const firstOther = user?.id === data[0].creator.id ? data[0].editor : data[0].creator
          setSelectedPersonId(firstOther.id)
          setSelectedConvId(data[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  function getOther(conv: ConversationDTO) {
    return user?.id === conv.creator.id ? conv.editor : conv.creator
  }

  // Group conversations by other party
  const groups: PersonGroup[] = []
  const seen = new Map<string, number>()

  for (const conv of conversations) {
    const other = getOther(conv)
    if (seen.has(other.id)) {
      groups[seen.get(other.id)!].conversations.push(conv)
    } else {
      seen.set(other.id, groups.length)
      groups.push({
        personId: other.id,
        personName: other.name,
        personAvatar: other.avatarUrl,
        conversations: [conv],
        latestMessage: conv.lastMessage?.content ?? null,
        latestTime: conv.lastMessage?.createdAt ?? null,
      })
    }
    // keep latestTime updated to the most recent message in the group
    const gi = seen.get(other.id)!
    if (conv.lastMessage && (!groups[gi].latestTime || conv.lastMessage.createdAt > groups[gi].latestTime!)) {
      groups[gi].latestMessage = conv.lastMessage.content
      groups[gi].latestTime = conv.lastMessage.createdAt
    }
  }

  const selectedGroup = groups.find((g) => g.personId === selectedPersonId) ?? null
  const selectedConv = selectedGroup?.conversations.find((c) => c.id === selectedConvId)
    ?? selectedGroup?.conversations[0]
    ?? null

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <IconLoader2 size={24} stroke={1.5} color="var(--brand)" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '64px 32px', background: 'var(--surface-subtle)',
        border: '1px solid var(--border)', borderRadius: 12, textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: 'var(--brand-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <IconMessage2 size={28} stroke={1.5} color="var(--brand)" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: '0 0 8px', fontFamily: "'Syne', sans-serif" }}>
          Nenhuma conversa
        </h3>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)', margin: 0, maxWidth: 320 }}>
          As conversas aparecem aqui quando um pedido for criado.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 124px)', minHeight: 480,
      border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
    }}>
      {/* ── Left: People list ── */}
      <div style={{
        width: 260, flexShrink: 0, borderRight: '1px solid var(--border)',
        background: 'var(--card)', overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)',
            fontFamily: "'Syne', sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em',
          }}>
            Mensagens
          </span>
        </div>

        {groups.map((group) => {
          const isSelected = selectedPersonId === group.personId
          return (
            <button
              key={group.personId}
              onClick={() => {
                setSelectedPersonId(group.personId)
                setSelectedConvId(group.conversations[0].id)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', width: '100%', textAlign: 'left',
                background: isSelected ? 'var(--brand-soft)' : 'transparent',
                borderLeft: isSelected ? '3px solid var(--brand)' : '3px solid transparent',
                border: 'none',
                borderBottom: '1px solid var(--surface-subtle)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-subtle)' }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              <Avatar name={group.personName} avatarUrl={group.personAvatar} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{
                    fontSize: 13, fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? 'white' : 'var(--foreground)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: "'Syne', sans-serif",
                  }}>
                    {group.personName}
                  </span>
                  {group.latestTime && (
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0, marginLeft: 6 }}>
                      {relativeDate(group.latestTime)}
                    </span>
                  )}
                </div>
                {group.latestMessage ? (
                  <p style={{
                    fontSize: 12, color: 'var(--muted-foreground)', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {group.latestMessage}
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
                    {group.conversations.length} projeto{group.conversations.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Right: Chat area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--background)' }}>
        {selectedGroup && selectedConv ? (
          <>
            {/* Chat header: person name */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
              borderBottom: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0,
            }}>
              <Avatar name={selectedGroup.personName} avatarUrl={selectedGroup.personAvatar} size={32} />
              <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0, fontFamily: "'Syne', sans-serif" }}>
                {selectedGroup.personName}
              </p>
              {selectedConv.order && (
                <button
                  onClick={() => navigate(`/orders/${selectedConv.order!.id}`)}
                  style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 6, fontSize: 11,
                    background: 'var(--border)', border: '1px solid var(--border)',
                    color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--brand-soft)'
                    e.currentTarget.style.color = 'var(--brand)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--border)'
                    e.currentTarget.style.color = 'var(--muted-foreground)'
                  }}
                >
                  <IconExternalLink size={12} stroke={1.5} />
                  Ver pedido
                </button>
              )}
            </div>

            {/* Project pills — shown when this person has multiple orders */}
            {selectedGroup.conversations.length > 1 && (
              <div style={{
                display: 'flex', justifyContent: 'center', gap: 8, padding: '10px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface-subtle)', flexShrink: 0, flexWrap: 'wrap',
              }}>
                {selectedGroup.conversations.map((conv) => {
                  const isActive = conv.id === selectedConv.id
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      style={{
                        padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: isActive ? 600 : 400,
                        background: isActive ? 'var(--brand)' : 'var(--border)',
                        color: isActive ? 'white' : 'var(--muted-foreground)',
                        border: isActive ? 'none' : '1px solid var(--input)',
                        cursor: 'pointer', transition: 'all 0.15s',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {conv.order?.title ?? 'Conversa direta'}
                    </button>
                  )
                })}
              </div>
            )}

            <ChatPanel conversation={selectedConv} compact={false} />
          </>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--muted-foreground)', fontSize: 14,
            flexDirection: 'column', gap: 12,
          }}>
            <IconMessage2 size={32} stroke={1.5} />
            Selecione uma conversa
          </div>
        )}
      </div>
    </div>
  )
}
