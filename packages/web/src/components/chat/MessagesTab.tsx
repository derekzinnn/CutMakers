import { Avatar } from '@/components/ui/Avatar'
import { relativeDate } from '@/lib/format'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconMessage2, IconLoader2, IconExternalLink } from '@tabler/icons-react'
import { listConversations, type ConversationDTO } from '@/lib/conversations'
import { useAuth } from '@/hooks/use-auth'
import { ChatPanel } from './ChatPanel'

// Paleta CATEGORICA de identidade (avatar por usuario): precisa de matizes
// DISTINTOS entre si, entao fica fora dos tokens do tema. Os chart-* do
// preset sao todos laranja/ambar — usa-los deixaria todo avatar igual.

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
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    setLoading(true)
    listConversations(page)
      .then((res) => {
        setConversations(res.conversations)
        setTotalPages(res.totalPages)
        // So auto-seleciona na primeira pagina: paginar nao deve sequestrar a
        // conversa que a pessoa estava lendo
        if (page === 1 && res.conversations.length > 0 && !selectedConvId) {
          const first = res.conversations[0]
          const firstOther = user?.id === first.creator.id ? first.editor : first.creator
          setSelectedPersonId(firstOther.id)
          setSelectedConvId(first.id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // selectedConvId de proposito fora das deps: incluir refaria a busca a cada
    // troca de conversa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page])

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
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', margin: '0 0 8px', fontFamily: "var(--font-heading)" }}>
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
      display: 'flex', height: 'calc(100dvh - 124px)', minHeight: 480,
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
            fontFamily: "var(--font-heading)", textTransform: 'uppercase', letterSpacing: '0.1em',
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
              <Avatar name={group.personName} url={group.personAvatar} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <span style={{
                    fontSize: 13, fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? 'white' : 'var(--foreground)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: "var(--font-heading)",
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

        {/* Paginacao da barra lateral: a lista cresce uma conversa por pedido,
            entao sem teto ela viraria uma rolagem infinita de centenas de itens.
            So aparece quando ha mais de uma pagina. */}
        {totalPages > 1 && (
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)',
            }}
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11,
                background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                color: page <= 1 ? 'var(--muted-foreground)' : 'var(--foreground)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                opacity: page <= 1 ? 0.5 : 1,
              }}
            >
              Anterior
            </button>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11,
                background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                color: page >= totalPages ? 'var(--muted-foreground)' : 'var(--foreground)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages ? 0.5 : 1,
              }}
            >
              Próxima
            </button>
          </div>
        )}
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
              <Avatar name={selectedGroup.personName} url={selectedGroup.personAvatar} size={32} />
              <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0, fontFamily: "var(--font-heading)" }}>
                {selectedGroup.personName}
              </p>
              {selectedConv.order && (
                <button
                  onClick={() => navigate(`/orders/${selectedConv.order!.id}`)}
                  style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 6, fontSize: 11,
                    background: 'var(--border)', border: '1px solid var(--border)',
                    color: 'var(--muted-foreground)', cursor: 'pointer', fontFamily: "var(--font-body)",
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
                        fontFamily: "var(--font-body)",
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
