import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  IconArrowLeft,
  IconFile,
  IconDownload,
  IconLoader2,
  IconCheck,
  IconX,
  IconRefresh,
  IconPlayerPlay,
  IconCreditCard,
  IconAlertCircle,
  IconUpload,
} from '@tabler/icons-react'
import { useAuth } from '@/hooks/use-auth'
import {
  getOrder,
  updateOrderStatus,
  createDelivery,
  initiatePayment,
  STATUS_LABELS,
  STATUS_COLORS,
  TRANSACTION_LABELS,
  type OrderDetailDTO,
  type OrderStatus,
} from '@/lib/orders'
import { uploadFile } from '@/lib/upload'

// ─── Stepper ────────────────────────────────────────────────────────────────

const HAPPY_PATH: OrderStatus[] = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED']

function StatusStepper({ current }: { current: OrderStatus }) {
  const isBad = current === 'CANCELLED' || current === 'DISPUTED'
  const isRevision = current === 'REVISION_REQUESTED'

  return (
    <div className="mb-6 w-full overflow-x-auto">
      {isBad && (
        <div
          className="rounded-[8px] px-4 py-2 text-center text-sm font-medium"
          style={{
            background: current === 'CANCELLED' ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            color: '#EF4444',
          }}
        >
          {STATUS_LABELS[current]}
        </div>
      )}

      {isRevision && (
        <div
          className="rounded-[8px] px-4 py-2 text-center text-sm font-medium"
          style={{
            background: 'rgba(234,179,8,0.1)',
            border: '1px solid rgba(234,179,8,0.25)',
            color: '#EAB308',
          }}
        >
          Revisão solicitada — editor revisará o pedido em breve
        </div>
      )}

      {!isBad && !isRevision && (
        <div className="flex items-center gap-0">
          {HAPPY_PATH.map((step, i) => {
            const stepIndex = HAPPY_PATH.indexOf(step)
            const currentIndex = HAPPY_PATH.indexOf(current)
            const isDone = stepIndex < currentIndex
            const isActive = step === current
            const color = STATUS_COLORS[step]

            return (
              <div key={step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1" style={{ minWidth: 72 }}>
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all"
                    style={{
                      background: isDone
                        ? '#22C55E'
                        : isActive
                          ? color
                          : 'rgba(255,255,255,0.06)',
                      border: isActive ? `2px solid ${color}` : isDone ? '2px solid #22C55E' : '2px solid rgba(255,255,255,0.1)',
                      color: isDone || isActive ? 'white' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {isDone ? <IconCheck size={12} stroke={2.5} /> : i + 1}
                  </div>
                  <span
                    className="text-center text-[10px] leading-tight"
                    style={{ color: isActive ? color : isDone ? '#22C55E' : 'rgba(255,255,255,0.3)' }}
                  >
                    {STATUS_LABELS[step]}
                  </span>
                </div>
                {i < HAPPY_PATH.length - 1 && (
                  <div
                    className="mb-4 h-px flex-1"
                    style={{ background: stepIndex < currentIndex ? '#22C55E' : 'rgba(255,255,255,0.08)' }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Delivery form embutido ─────────────────────────────────────────────────

function DeliveryForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [useUpload, setUseUpload] = useState(true)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setError(null)
    setUploading(true)
    setProgress(0)
    try {
      const result = await uploadFile(file, 'deliveries', 'video', setProgress)
      setVideoUrl(result.secureUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload')
      setVideoFile(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!videoUrl) return setError('Adicione o vídeo da entrega')
    setSubmitting(true)
    setError(null)
    try {
      await createDelivery(orderId, { videoUrl, message: message.trim() || undefined })
      onDone()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao enviar entrega')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-4 rounded-[12px] p-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <p className="text-sm font-semibold text-white">Enviar entrega</p>

      {/* Toggle: upload vs URL */}
      <div className="flex gap-2">
        {[{ v: true, l: 'Upload de arquivo' }, { v: false, l: 'Colar URL' }].map(({ v, l }) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => setUseUpload(v)}
            className="rounded-[6px] px-3 py-1.5 text-xs transition-all"
            style={{
              background: useUpload === v ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.04)',
              color: useUpload === v ? '#F4631E' : 'rgba(255,255,255,0.5)',
              border: useUpload === v ? '1px solid rgba(244,99,30,0.3)' : '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {useUpload ? (
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[8px] px-4 py-5 text-xs transition-colors"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px dashed rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          {uploading ? (
            <>
              <IconLoader2 size={18} className="animate-spin" />
              <span>Enviando... {progress}%</span>
            </>
          ) : videoFile ? (
            <>
              <IconCheck size={18} style={{ color: '#22C55E' }} />
              <span style={{ color: '#22C55E' }}>{videoFile.name}</span>
            </>
          ) : (
            <>
              <IconUpload size={18} />
              <span>Clique para selecionar o vídeo</span>
            </>
          )}
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading || submitting}
          />
        </label>
      ) : (
        <input
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-[8px] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          disabled={submitting}
        />
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Mensagem para o creator (opcional)..."
        rows={3}
        maxLength={2000}
        className="w-full rounded-[8px] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          resize: 'vertical',
        }}
        disabled={submitting}
      />

      {error && (
        <p className="text-xs" style={{ color: '#FCA5A5' }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={submitting || uploading || !videoUrl}
          className="flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold transition-all"
          style={{
            background: '#F4631E',
            color: 'white',
            border: 'none',
            cursor: submitting || uploading || !videoUrl ? 'not-allowed' : 'pointer',
            opacity: submitting || uploading || !videoUrl ? 0.6 : 1,
            fontFamily: "'Syne', sans-serif",
          }}
        >
          {submitting && <IconLoader2 size={14} className="animate-spin" />}
          {submitting ? 'Enviando...' : 'Confirmar entrega'}
        </button>
      </div>
    </form>
  )
}

// ─── Botões de ação ─────────────────────────────────────────────────────────

function ActionButtons({
  order,
  perspective,
  onAction,
  onPayment,
  onRefresh,
}: {
  order: OrderDetailDTO
  perspective: 'creator' | 'editor' | 'admin'
  onAction: (status: OrderStatus) => Promise<void>
  onPayment: () => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [showDelivery, setShowDelivery] = useState(false)

  async function doAction(status: OrderStatus) {
    setBusy(status)
    await onAction(status)
    setBusy(null)
  }

  async function doPay() {
    setBusy('pay')
    await onPayment()
    setBusy(null)
  }

  const btn = (
    label: string,
    onClick: () => void,
    key: string,
    variant: 'primary' | 'danger' | 'ghost' = 'ghost',
    icon?: React.ReactNode,
  ) => (
    <button
      key={key}
      onClick={onClick}
      disabled={busy !== null}
      className="flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-sm font-semibold transition-all"
      style={{
        background:
          variant === 'primary'
            ? '#F4631E'
            : variant === 'danger'
              ? 'rgba(239,68,68,0.1)'
              : 'rgba(255,255,255,0.06)',
        color: variant === 'primary' ? 'white' : variant === 'danger' ? '#EF4444' : 'rgba(255,255,255,0.8)',
        border:
          variant === 'primary'
            ? 'none'
            : variant === 'danger'
              ? '1px solid rgba(239,68,68,0.3)'
              : '1px solid rgba(255,255,255,0.1)',
        cursor: busy !== null ? 'not-allowed' : 'pointer',
        opacity: busy !== null ? 0.7 : 1,
        fontFamily: "'Syne', sans-serif",
      }}
    >
      {busy === key ? <IconLoader2 size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  )

  const { status, transaction } = order

  // ── Editor ──
  if (perspective === 'editor') {
    if (status === 'PENDING') {
      return (
        <div className="flex flex-col gap-2">
          {btn('Aceitar pedido', () => doAction('ACCEPTED'), 'ACCEPTED', 'primary', <IconCheck size={14} stroke={2} />)}
          {btn('Recusar', () => doAction('CANCELLED'), 'CANCELLED', 'danger', <IconX size={14} stroke={2} />)}
        </div>
      )
    }
    if (status === 'ACCEPTED') {
      return btn('Iniciar trabalho', () => doAction('IN_PROGRESS'), 'IN_PROGRESS', 'primary', <IconPlayerPlay size={14} stroke={1.5} />)
    }
    if (status === 'IN_PROGRESS') {
      return (
        <>
          {btn(
            showDelivery ? 'Cancelar envio' : 'Enviar entrega',
            () => setShowDelivery(!showDelivery),
            'delivery',
            'primary',
            <IconUpload size={14} stroke={1.5} />,
          )}
          {showDelivery && (
            <DeliveryForm
              orderId={order.id}
              onDone={async () => {
                setShowDelivery(false)
                await onRefresh()
              }}
            />
          )}
        </>
      )
    }
    if (status === 'REVISION_REQUESTED') {
      return btn('Iniciar revisão', () => doAction('IN_PROGRESS'), 'IN_PROGRESS', 'primary', <IconRefresh size={14} stroke={1.5} />)
    }
    return null
  }

  // ── Creator ──
  if (perspective === 'creator') {
    if (status === 'PENDING') {
      return btn('Cancelar pedido', () => doAction('CANCELLED'), 'CANCELLED', 'danger', <IconX size={14} stroke={2} />)
    }
    if (status === 'ACCEPTED') {
      return (
        <div className="flex flex-col gap-2">
          {!transaction &&
            btn(
              'Pagar agora (PIX)',
              doPay,
              'pay',
              'primary',
              <IconCreditCard size={14} stroke={1.5} />,
            )}
          {btn('Cancelar pedido', () => doAction('CANCELLED'), 'CANCELLED', 'danger', <IconX size={14} stroke={2} />)}
        </div>
      )
    }
    if (status === 'DELIVERED') {
      return (
        <div className="flex flex-col gap-2">
          {btn('Aprovar entrega', () => doAction('COMPLETED'), 'COMPLETED', 'primary', <IconCheck size={14} stroke={2} />)}
          {btn('Solicitar revisão', () => doAction('REVISION_REQUESTED'), 'REVISION_REQUESTED', 'ghost', <IconRefresh size={14} stroke={1.5} />)}
        </div>
      )
    }
    return null
  }

  return null
}

// ─── Página principal ────────────────────────────────────────────────────────

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order, setOrder] = useState<OrderDetailDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getOrder(id)
      setOrder(data)
    } catch {
      setError('Pedido não encontrado ou você não tem acesso.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (!user) return null

  const perspective = (() => {
    if (user.role === 'ADMIN') return 'admin' as const
    if (order?.creator.id === user.id) return 'creator' as const
    if (order?.editor.id === user.id) return 'editor' as const
    return 'creator' as const
  })()

  async function handleAction(newStatus: OrderStatus) {
    if (!order) return
    setActionError(null)
    try {
      const updated = await updateOrderStatus(order.id, newStatus as OrderStatus)
      setOrder(updated)
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setActionError(e?.response?.data?.message ?? 'Erro ao atualizar status')
    }
  }

  async function handlePayment() {
    if (!order) return
    setPayError(null)
    try {
      const result = await initiatePayment(order.id)
      if (result.paymentUrl) {
        window.open(result.paymentUrl, '_blank')
      }
      await load()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setPayError(e?.response?.data?.message ?? 'Erro ao iniciar pagamento')
    }
  }

  const statusColor = order ? STATUS_COLORS[order.status] : '#F4631E'
  const counterpart = order
    ? perspective === 'creator'
      ? order.editor
      : order.creator
    : null
  const counterpartLabel = perspective === 'creator' ? 'Editor' : 'Creator'

  return (
    <div className="min-h-screen" style={{ background: '#0D1B2A' }}>
      {/* ── Top Bar ── */}
      <header
        className="flex items-center gap-4 px-6 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#162436' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
          }}
        >
          <IconArrowLeft size={14} stroke={1.5} />
          Voltar
        </button>

        <div className="flex-1">
          <span
            className="font-heading text-[18px] font-extrabold text-white"
          >
            CutMakers
          </span>
        </div>

        {order && (
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            style={{
              background: `${statusColor}1A`,
              color: statusColor,
              border: `1px solid ${statusColor}33`,
            }}
          >
            {STATUS_LABELS[order.status]}
          </span>
        )}
      </header>

      {/* ── Content ── */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <IconLoader2 size={28} className="animate-spin" style={{ color: '#F4631E' }} />
          </div>
        )}

        {error && (
          <div
            className="rounded-[12px] p-6 text-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}
          >
            <IconAlertCircle size={28} className="mx-auto mb-2" />
            {error}
          </div>
        )}

        {!loading && order && (
          <>
            {/* Order header */}
            <div className="mb-6">
              <p className="mb-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {order.category.name} · criado em {new Date(order.createdAt).toLocaleDateString('pt-BR')}
              </p>
              <h1 className="font-heading text-2xl font-bold text-white">{order.title}</h1>
            </div>

            {/* Stepper */}
            <StatusStepper current={order.status} />

            {/* 2-col layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
              {/* ── Left: main content ── */}
              <div className="space-y-6">
                {/* Description */}
                <Section title="Briefing">
                  <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {order.description}
                  </p>
                </Section>

                {/* Files */}
                {order.files.length > 0 && (
                  <Section title={`Arquivos de referência (${order.files.length})`}>
                    <ul className="space-y-2">
                      {order.files.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <IconFile size={16} stroke={1.5} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                          <span className="flex-1 truncate text-white">{f.fileName}</span>
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            {f.fileType}
                          </span>
                          <a
                            href={f.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-7 w-7 items-center justify-center rounded-[6px] transition-all"
                            style={{
                              background: 'rgba(244,99,30,0.1)',
                              color: '#F4631E',
                              textDecoration: 'none',
                            }}
                          >
                            <IconDownload size={13} stroke={1.5} />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Deliveries */}
                {order.deliveries.length > 0 && (
                  <Section title={`Entregas (${order.deliveries.length})`}>
                    <ul className="space-y-3">
                      {order.deliveries.map((d) => (
                        <li
                          key={d.id}
                          className="rounded-[8px] p-4"
                          style={{
                            background: 'rgba(168,85,247,0.06)',
                            border: '1px solid rgba(168,85,247,0.2)',
                          }}
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                              style={{ background: 'rgba(168,85,247,0.2)', color: '#A855F7' }}
                            >
                              v{d.version}
                            </span>
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                              {new Date(d.createdAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {d.message && (
                            <p className="mb-3 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
                              {d.message}
                            </p>
                          )}
                          <a
                            href={d.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-xs font-medium transition-all"
                            style={{
                              background: 'rgba(168,85,247,0.15)',
                              color: '#A855F7',
                              textDecoration: 'none',
                              border: '1px solid rgba(168,85,247,0.3)',
                            }}
                          >
                            <IconPlayerPlay size={12} stroke={1.5} />
                            Abrir vídeo
                          </a>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Action error */}
                {actionError && (
                  <div
                    className="rounded-[8px] px-4 py-3 text-xs"
                    style={{
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#FCA5A5',
                    }}
                  >
                    {actionError}
                  </div>
                )}
              </div>

              {/* ── Right: sidebar ── */}
              <div className="space-y-4">
                {/* Counterpart info */}
                {counterpart && (
                  <SideCard>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {counterpartLabel}
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-sm font-bold text-white"
                        style={{ background: '#F4631E' }}
                      >
                        {counterpart.avatarUrl ? (
                          <img src={counterpart.avatarUrl} alt={counterpart.name} className="h-full w-full object-cover" />
                        ) : (
                          counterpart.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <p className="font-medium text-white">{counterpart.name}</p>
                    </div>
                  </SideCard>
                )}

                {/* Budget */}
                <SideCard>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Financeiro
                  </p>
                  <div className="space-y-2 text-sm">
                    <Row label="Orçamento" value={`R$ ${order.budget.toFixed(2)}`} />
                    <Row label="Taxa (10%)" value={`R$ ${order.platformFee.toFixed(2)}`} muted />
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                      <Row
                        label="Editor recebe"
                        value={`R$ ${(order.budget - order.platformFee).toFixed(2)}`}
                        highlight
                      />
                    </div>
                    {order.deadline && (
                      <Row
                        label="Prazo"
                        value={new Date(order.deadline).toLocaleDateString('pt-BR')}
                      />
                    )}
                  </div>
                </SideCard>

                {/* Payment */}
                <SideCard>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Pagamento
                  </p>
                  {order.transaction ? (
                    <div className="space-y-1 text-sm">
                      <span
                        className="inline-block rounded-full px-2.5 py-1 text-[11px] font-medium"
                        style={{
                          background:
                            order.transaction.status === 'RELEASED'
                              ? 'rgba(34,197,94,0.15)'
                              : order.transaction.status === 'HELD'
                                ? 'rgba(59,130,246,0.15)'
                                : 'rgba(244,99,30,0.15)',
                          color:
                            order.transaction.status === 'RELEASED'
                              ? '#22C55E'
                              : order.transaction.status === 'HELD'
                                ? '#3B82F6'
                                : '#F4631E',
                        }}
                      >
                        {TRANSACTION_LABELS[order.transaction.status]}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Aguardando aceitação do editor para iniciar pagamento.
                    </p>
                  )}
                  {payError && (
                    <p className="mt-2 text-xs" style={{ color: '#FCA5A5' }}>
                      {payError}
                    </p>
                  )}
                </SideCard>

                {/* Actions */}
                <SideCard>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Ações
                  </p>
                  <ActionButtons
                    order={order}
                    perspective={perspective}
                    onAction={handleAction}
                    onPayment={handlePayment}
                    onRefresh={load}
                  />
                </SideCard>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ─── Sub-componentes de layout ───────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[12px] p-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <h2 className="mb-3 font-heading text-sm font-semibold text-white">{title}</h2>
      {children}
    </div>
  )
}

function SideCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[12px] p-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {children}
    </div>
  )
}

function Row({
  label,
  value,
  muted,
  highlight,
}: {
  label: string
  value: string
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: muted ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)' }}>{label}</span>
      <span
        style={{
          color: highlight ? '#F4631E' : muted ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)',
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  )
}
