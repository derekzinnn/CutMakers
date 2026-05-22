import { useState, useEffect, useRef, useCallback } from 'react'
import { IconSend, IconLoader2 } from '@tabler/icons-react'
import { getMessages, sendMessage, type MessageDTO, type ConversationDTO } from '@/lib/conversations'
import { useAuth } from '@/hooks/use-auth'

// ─── Avatar helper ────────────────────────────────────────────────────────────

const AVATAR_PALETTE = ['#F4631E', '#3B82F6', '#A855F7', '#22C55E', '#EAB308', '#EC4899', '#14B8A6']

function nameHash(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function Avatar({ name, avatarUrl, size = 32 }: { name: string; avatarUrl: string | null; size?: number }) {
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

// ─── Time format ──────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

interface ChatPanelProps {
  conversation: ConversationDTO
  compact?: boolean // true = inline widget in OrderDetailPage
}

export function ChatPanel({ conversation, compact = false }: ChatPanelProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<MessageDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const msgs = await getMessages(conversation.id)
      setMessages(msgs)
    } catch {
      // silent — keeps showing old messages
    } finally {
      setLoading(false)
    }
  }, [conversation.id])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Polling every 3s
  useEffect(() => {
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [load])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    try {
      const msg = await sendMessage(conversation.id, text)
      setMessages((prev) => [...prev, msg])
    } catch {
      setInput(text) // restore on error
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const otherParty = user?.id === conversation.creator.id ? conversation.editor : conversation.creator

  const msgAreaHeight = compact ? 220 : '100%'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: compact ? 360 : '100%',
        background: '#0D1B2A',
        borderRadius: compact ? 12 : 0,
        overflow: 'hidden',
        border: compact ? '1px solid rgba(255,255,255,0.08)' : 'none',
      }}
    >
      {/* Header */}
      {compact && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: '#162436',
            flexShrink: 0,
          }}
        >
          <Avatar name={otherParty.name} avatarUrl={otherParty.avatarUrl} size={28} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'white', margin: 0 }}>{otherParty.name}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              {conversation.order?.title ?? 'Conversa'}
            </p>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 0,
          maxHeight: typeof msgAreaHeight === 'number' ? msgAreaHeight : undefined,
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <IconLoader2 size={20} stroke={1.5} color="#F4631E" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: 13,
              margin: 'auto',
              padding: '20px 0',
            }}
          >
            Nenhuma mensagem ainda. Diga olá!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender.id === user?.id
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 8,
                }}
              >
                {!isMe && (
                  <Avatar name={msg.sender.name} avatarUrl={msg.sender.avatarUrl} size={24} />
                )}
                <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 2 }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      background: isMe ? '#F4631E' : 'rgba(255,255,255,0.07)',
                      color: 'white',
                      fontSize: 13,
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: '#162436',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            padding: '8px 12px',
            color: 'white',
            fontSize: 13,
            outline: 'none',
            fontFamily: "'DM Sans', sans-serif",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: input.trim() && !sending ? '#F4631E' : 'rgba(255,255,255,0.07)',
            border: 'none',
            cursor: input.trim() && !sending ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
            flexShrink: 0,
          }}
        >
          <IconSend size={16} stroke={2} color="white" />
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
