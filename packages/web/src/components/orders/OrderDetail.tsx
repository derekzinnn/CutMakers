import { useEffect, useState } from 'react'
import {
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
  IconStarFilled,
  IconArrowLeft,
  IconClock,
  IconArrowsExchange,
  IconCircleCheck,
  IconCircleX,
  IconArrowRight,
  IconGavel,
  IconAlertTriangle,
  IconFileText,
  IconPrinter,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react'
import { useAuth } from '@/hooks/use-auth'
import {
  getOrder,
  updateOrderStatus,
  createDelivery,
  initiatePayment,
  addOrderFiles,
  STATUS_LABELS,
  STATUS_COLORS,
  TRANSACTION_LABELS,
  type OrderDetailDTO,
  type OrderStatus,
} from '@/lib/orders'
import {
  createProposal,
  acceptProposal,
  rejectProposal,
  PROPOSAL_STATUS_LABELS,
  type ProposalDTO,
} from '@/lib/proposals'
import { createReview } from '@/lib/reviews'
import { createRevision, REVISION_STATUS_LABELS, type RevisionDTO } from '@/lib/revisions'
import { openDispute, resolveDispute, type DisputeResolution } from '@/lib/disputes'
import { acceptAgreement } from '@/lib/agreements'
import { uploadFile } from '@/lib/upload'
import { getOrCreateConversationByOrder, type ConversationDTO } from '@/lib/conversations'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { Modal } from '@/components/ui/Modal'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(n: number) {
  return `R$ ${n.toFixed(2)}`
}

function avatarBg(name: string) {
  const PALETTE = ['#F4631E', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % PALETTE.length
  return PALETTE[h]
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function ContentSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-[12px] p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function SideCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      {children}
    </div>
  )
}

function Row({ label, value, muted, highlight }: { label: string; value: string; muted?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm" style={{ color: muted ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)' }}>{label}</span>
      <span className="text-sm" style={{ color: highlight ? '#F4631E' : muted ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)', fontWeight: highlight ? 600 : 400 }}>
        {value}
      </span>
    </div>
  )
}

// ─── Status Stepper ───────────────────────────────────────────────────────────

const NEW_HAPPY_PATH: OrderStatus[] = ['NEGOTIATING', 'AWAITING_PAYMENT', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED']
const OLD_HAPPY_PATH: OrderStatus[] = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED']

function StatusStepper({ order }: { order: OrderDetailDTO }) {
  const isBad = order.status === 'CANCELLED' || order.status === 'DISPUTED'
  const isRevision = order.status === 'REVISION_REQUESTED'

  // Use new path if the order has proposals (i.e. was created after negotiation feature)
  const isNewFlow = order.proposals.length > 0 || order.status === 'NEGOTIATING' || order.status === 'AWAITING_PAYMENT'
  const happyPath = isNewFlow ? NEW_HAPPY_PATH : OLD_HAPPY_PATH

  return (
    <div className="mb-6 w-full overflow-x-auto">
      {isBad && (
        <div className="rounded-[8px] px-4 py-2 text-center text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
          {STATUS_LABELS[order.status]}
        </div>
      )}
      {isRevision && (
        <div className="rounded-[8px] px-4 py-2 text-center text-sm font-medium" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', color: '#EAB308' }}>
          Revisão solicitada — editor revisará em breve
        </div>
      )}
      {!isBad && !isRevision && (
        <div className="flex items-center gap-0">
          {happyPath.map((step, i) => {
            const stepIndex = happyPath.indexOf(step)
            const currentIndex = happyPath.indexOf(order.status)
            const isDone = stepIndex < currentIndex
            const isActive = step === order.status
            const color = STATUS_COLORS[step]
            return (
              <div key={step} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1" style={{ minWidth: 72 }}>
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-all"
                    style={{
                      background: isDone ? '#22C55E' : isActive ? color : 'rgba(255,255,255,0.06)',
                      border: isActive ? `2px solid ${color}` : isDone ? '2px solid #22C55E' : '2px solid rgba(255,255,255,0.1)',
                      color: isDone || isActive ? 'white' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {isDone ? <IconCheck size={12} stroke={2.5} /> : i + 1}
                  </div>
                  <span className="text-center text-[10px] leading-tight" style={{ color: isActive ? color : isDone ? '#22C55E' : 'rgba(255,255,255,0.3)' }}>
                    {STATUS_LABELS[step]}
                  </span>
                </div>
                {i < happyPath.length - 1 && (
                  <div className="mb-4 h-px flex-1" style={{ background: stepIndex < currentIndex ? '#22C55E' : 'rgba(255,255,255,0.08)' }} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Negotiation Section ──────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  order,
  currentUserId,
  perspective,
  onRefresh,
}: {
  proposal: ProposalDTO
  order: OrderDetailDTO
  currentUserId: string
  perspective: 'creator' | 'editor' | 'admin'
  onRefresh: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isOwn = proposal.proposedBy === currentUserId
  const isPending = proposal.status === 'PENDING'
  const canRespond = isPending && !isOwn && perspective !== 'admin' // admin uses PATCH /status

  async function handleAccept() {
    setBusy('accept')
    setError(null)
    try {
      await acceptProposal(order.id, proposal.id)
      onRefresh()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao aceitar proposta')
    } finally {
      setBusy(null)
    }
  }

  async function handleReject() {
    setBusy('reject')
    setError(null)
    try {
      await rejectProposal(order.id, proposal.id)
      onRefresh()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao rejeitar proposta')
    } finally {
      setBusy(null)
    }
  }

  const statusColors: Record<string, { bg: string; color: string }> = {
    PENDING: { bg: 'rgba(244,99,30,0.12)', color: '#F4631E' },
    ACCEPTED: { bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
    REJECTED: { bg: 'rgba(239,68,68,0.12)', color: '#EF4444' },
    COUNTERED: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' },
  }
  const sc = statusColors[proposal.status] ?? statusColors.COUNTERED

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className="max-w-[85%] rounded-[12px] p-4"
        style={{
          background: isOwn ? 'rgba(244,99,30,0.08)' : 'rgba(255,255,255,0.04)',
          border: isOwn ? '1px solid rgba(244,99,30,0.2)' : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header: name + time */}
        <div className="mb-2 flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: avatarBg(proposal.user.name) }}
          >
            {proposal.user.avatarUrl
              ? <img src={proposal.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
              : proposal.user.name.charAt(0).toUpperCase()
            }
          </div>
          <span className="text-xs font-medium text-white">{proposal.user.name}</span>
          <span className="ml-auto text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {new Date(proposal.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Amount */}
        <div className="mb-1 flex items-baseline gap-2">
          <span className="font-heading text-xl font-bold text-white">{fmtBRL(proposal.amount)}</span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: sc.bg, color: sc.color }}
          >
            {PROPOSAL_STATUS_LABELS[proposal.status]}
          </span>
        </div>

        {/* Fee breakdown */}
        <div className="mb-2 space-y-0.5">
          {perspective === 'editor' && (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Você recebe: <span style={{ color: '#22C55E', fontWeight: 600 }}>{fmtBRL(proposal.netAmount)}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}> · taxa 10%: {fmtBRL(proposal.platformFee)}</span>
            </p>
          )}
          {perspective === 'creator' && (
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Você paga: <span className="font-medium text-white">{fmtBRL(proposal.amount)}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}> · editor recebe: {fmtBRL(proposal.netAmount)}</span>
            </p>
          )}
        </div>

        {/* Message */}
        {proposal.message && (
          <p className="mb-3 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {proposal.message}
          </p>
        )}

        {/* Actions for the other party on a pending proposal */}
        {canRespond && (
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: '#F4631E', color: 'white', border: 'none',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.6 : 1,
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {busy === 'accept' ? <IconLoader2 size={12} className="animate-spin" /> : <IconCircleCheck size={12} stroke={2} />}
              Aceitar
            </button>
            <button
              onClick={handleReject}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: 'rgba(239,68,68,0.1)', color: '#EF4444',
                border: '1px solid rgba(239,68,68,0.25)',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.6 : 1,
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {busy === 'reject' ? <IconLoader2 size={12} className="animate-spin" /> : <IconCircleX size={12} stroke={2} />}
              Rejeitar
            </button>
          </div>
        )}

        {isPending && isOwn && (
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <IconClock size={12} stroke={1.5} />
            Aguardando resposta da contraparte...
          </div>
        )}

        {error && <p className="mt-2 text-[11px]" style={{ color: '#FCA5A5' }}>{error}</p>}
      </div>
    </div>
  )
}

function ProposalForm({
  order,
  hasExistingPending,
  pendingIsOwn,
  onDone,
}: {
  order: OrderDetailDTO
  hasExistingPending: boolean
  pendingIsOwn: boolean
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (hasExistingPending && pendingIsOwn) return null

  const isCounter = hasExistingPending && !pendingIsOwn
  const label = isCounter ? 'Fazer contraproposta' : 'Fazer proposta'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseFloat(amount.replace(',', '.'))
    if (!parsed || parsed <= 0) return setError('Informe um valor válido')
    setSubmitting(true)
    setError(null)
    try {
      await createProposal(order.id, { amount: parsed, message: message.trim() || undefined })
      setAmount('')
      setMessage('')
      setOpen(false)
      onDone()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao enviar proposta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-sm font-semibold transition-all"
          style={{
            background: isCounter ? 'rgba(255,255,255,0.06)' : '#F4631E',
            color: isCounter ? 'rgba(255,255,255,0.8)' : 'white',
            border: isCounter ? '1px solid rgba(255,255,255,0.12)' : 'none',
            cursor: 'pointer',
            fontFamily: "'Syne', sans-serif",
          }}
        >
          <IconArrowRight size={14} stroke={2} />
          {label}
        </button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-[12px] p-4 space-y-3"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <p className="text-sm font-semibold text-white">{label}</p>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Valor (R$)</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-[8px] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              disabled={submitting}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Mensagem (opcional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explique sua proposta..."
              rows={2}
              maxLength={2000}
              className="w-full rounded-[8px] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
              disabled={submitting}
            />
          </div>
          {amount && !isNaN(parseFloat(amount.replace(',', '.'))) && parseFloat(amount.replace(',', '.')) > 0 && (
            <div className="rounded-[8px] px-3 py-2 text-xs space-y-0.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>Taxa plataforma (10%)</span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{fmtBRL(Math.round(parseFloat(amount.replace(',', '.')) * 0.1 * 100) / 100)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Editor recebe</span>
                <span style={{ color: '#22C55E' }}>{fmtBRL(Math.round(parseFloat(amount.replace(',', '.')) * 0.9 * 100) / 100)}</span>
              </div>
            </div>
          )}
          {error && <p className="text-xs" style={{ color: '#FCA5A5' }}>{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null) }}
              className="rounded-[8px] px-3 py-2 text-xs"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-xs font-semibold"
              style={{
                background: '#F4631E', color: 'white', border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                fontFamily: "'Syne', sans-serif",
              }}
            >
              {submitting && <IconLoader2 size={12} className="animate-spin" />}
              Enviar proposta
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function NegotiationSection({
  order,
  perspective,
  currentUserId,
  onRefresh,
}: {
  order: OrderDetailDTO
  perspective: 'creator' | 'editor' | 'admin'
  currentUserId: string
  onRefresh: () => void
}) {
  const pendingProposal = order.proposals.find((p) => p.status === 'PENDING') ?? null
  const hasExistingPending = pendingProposal !== null
  const pendingIsOwn = pendingProposal?.proposedBy === currentUserId

  return (
    <ContentSection title="Negociação">
      <div className="mb-3 flex items-center gap-2">
        <IconArrowsExchange size={14} stroke={1.5} style={{ color: '#F4631E' }} />
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Negocie o valor com a contraparte. Quando ambos concordarem, o creator realiza o pagamento e o projeto inicia.
        </p>
      </div>

      {order.proposals.length === 0 ? (
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhuma proposta ainda.</p>
      ) : (
        <div className="mb-4 space-y-3">
          {order.proposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              order={order}
              currentUserId={currentUserId}
              perspective={perspective}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {order.status === 'NEGOTIATING' && perspective !== 'admin' && (
        <ProposalForm
          order={order}
          hasExistingPending={hasExistingPending}
          pendingIsOwn={pendingIsOwn ?? false}
          onDone={onRefresh}
        />
      )}
    </ContentSection>
  )
}

// ─── Awaiting Payment Section ─────────────────────────────────────────────────

function AwaitingPaymentSection({
  order,
  perspective,
  onPayment,
  payError,
}: {
  order: OrderDetailDTO
  perspective: 'creator' | 'editor' | 'admin'
  onPayment: () => Promise<void>
  payError: string | null
}) {
  const [busy, setBusy] = useState(false)
  const accepted = order.proposals.filter((p) => p.status === 'ACCEPTED')
  const acceptedProposal = accepted[accepted.length - 1] ?? order.proposals[order.proposals.length - 1]

  if (perspective === 'editor') {
    return (
      <ContentSection title="Aguardando pagamento">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)' }}
          >
            <IconClock size={22} stroke={1.5} style={{ color: '#EAB308' }} />
          </div>
          <p className="font-heading text-sm font-semibold text-white">Aguardando pagamento do creator</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            O creator precisa realizar o pagamento PIX para o projeto iniciar.
          </p>
          {acceptedProposal && (
            <div className="mt-2 rounded-[10px] px-5 py-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Valor acordado</p>
              <p className="font-heading text-lg font-bold text-white">{fmtBRL(order.budget)}</p>
              <p className="text-xs" style={{ color: '#22C55E' }}>Você recebe {fmtBRL(order.budget - order.platformFee)}</p>
            </div>
          )}
        </div>
      </ContentSection>
    )
  }

  // Creator view
  const alreadyInitiated = order.transaction !== null
  const contractPending = order.agreement !== null && !order.agreement.bothAccepted

  async function handlePay() {
    setBusy(true)
    await onPayment()
    setBusy(false)
  }

  return (
    <ContentSection title="Pagamento">
      <div className="space-y-4">
        <div className="rounded-[10px] p-4" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)' }}>
          <p className="mb-1 text-xs font-semibold" style={{ color: '#EAB308' }}>Proposta aceita — realize o pagamento</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-bold text-white">{fmtBRL(order.budget)}</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>via PIX</span>
          </div>
          <div className="mt-1 space-y-0.5">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Taxa plataforma (10%): {fmtBRL(order.platformFee)} · Editor recebe: {fmtBRL(order.budget - order.platformFee)}
            </p>
          </div>
        </div>

        {contractPending && !alreadyInitiated ? (
          <div
            className="flex items-center gap-2 rounded-[8px] px-4 py-3"
            style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}
          >
            <IconFileText size={16} stroke={1.5} style={{ color: '#EAB308', flexShrink: 0 }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
              O pagamento libera após <strong style={{ color: '#EAB308' }}>ambas as partes aceitarem o contrato</strong> (seção acima).
            </p>
          </div>
        ) : !alreadyInitiated ? (
          <button
            onClick={handlePay}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-[8px] py-3 text-sm font-semibold transition-all"
            style={{
              background: '#F4631E', color: 'white', border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.7 : 1,
              fontFamily: "'Syne', sans-serif",
            }}
          >
            {busy ? <IconLoader2 size={16} className="animate-spin" /> : <IconCreditCard size={16} stroke={1.5} />}
            {busy ? 'Gerando cobrança...' : 'Pagar via PIX'}
          </button>
        ) : (
          <div className="rounded-[8px] px-4 py-3 text-center" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-sm font-medium" style={{ color: '#3B82F6' }}>Pagamento iniciado</p>
            <p className="mt-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Aguardando confirmação do PIX...
            </p>
          </div>
        )}

        {payError && (
          <p className="text-xs" style={{ color: '#FCA5A5' }}>{payError}</p>
        )}

        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          O pagamento fica retido em escrow e é liberado ao editor apenas quando você aprovar a entrega.
        </p>
      </div>
    </ContentSection>
  )
}

// ─── Delivery form ───────────────────────────────────────────────────────────

function DeliveryForm({ orderId, onDone, onClose }: { orderId: string; onDone: () => void; onClose: () => void }) {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 500, background: '#162436',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0, fontFamily: "'Syne', sans-serif" }}>
              Enviar entrega
            </h3>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '3px 0 0' }}>
              O creator será notificado para revisar e aprovar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}
          >
            <IconX size={18} stroke={1.5} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ v: true, l: 'Upload de arquivo' }, { v: false, l: 'Colar URL' }].map(({ v, l }) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setUseUpload(v)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  background: useUpload === v ? 'rgba(244,99,30,0.15)' : 'rgba(255,255,255,0.04)',
                  color: useUpload === v ? '#F4631E' : 'rgba(255,255,255,0.5)',
                  border: useUpload === v ? '1px solid rgba(244,99,30,0.3)' : '1px solid rgba(255,255,255,0.08)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Upload zone or URL input */}
          {useUpload ? (
            <label
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '28px 16px', borderRadius: 10, cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { if (!videoFile && !uploading) { e.currentTarget.style.background = 'rgba(244,99,30,0.05)'; e.currentTarget.style.borderColor = 'rgba(244,99,30,0.3)' } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
            >
              {uploading ? (
                <>
                  <IconLoader2 size={28} stroke={1.5} color="#F4631E" style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: 'white', margin: '0 0 4px', fontWeight: 500 }}>Enviando vídeo...</p>
                    <div style={{ width: 200, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: '#F4631E', transition: 'width 0.3s' }} />
                    </div>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>{progress}%</p>
                  </div>
                </>
              ) : videoFile ? (
                <>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconCheck size={22} stroke={2} color="#22C55E" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#22C55E', margin: '0 0 2px', fontWeight: 500 }}>Vídeo pronto</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{videoFile.name}</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(244,99,30,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconUpload size={20} stroke={1.5} color="#F4631E" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: '0 0 2px', fontWeight: 500 }}>Clique para selecionar o vídeo</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>MP4, MOV, AVI...</p>
                  </div>
                </>
              )}
              <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} disabled={uploading || submitting} />
            </label>
          ) : (
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://drive.google.com/... ou YouTube, Vimeo..."
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 8, fontSize: 13, color: 'white',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(244,99,30,0.5)' }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
              disabled={submitting}
            />
          )}

          {/* Message */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mensagem para o creator (opcional) — explique o que foi feito, decisões criativas, etc."
            rows={3}
            maxLength={2000}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 8, fontSize: 13, color: 'white',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              outline: 'none', resize: 'vertical', fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.6, boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(244,99,30,0.5)' }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)' }}
            disabled={submitting}
          />

          {error && (
            <p style={{ fontSize: 12, color: '#FCA5A5', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', margin: 0 }}>
              {error}
            </p>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 16px', borderRadius: 8, fontSize: 13, background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || uploading || !videoUrl}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px',
                borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "'Syne', sans-serif",
                background: '#F4631E', color: 'white', border: 'none',
                cursor: submitting || uploading || !videoUrl ? 'not-allowed' : 'pointer',
                opacity: submitting || uploading || !videoUrl ? 0.6 : 1,
              }}
            >
              {submitting && <IconLoader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {submitting ? 'Enviando...' : 'Confirmar entrega'}
            </button>
          </div>
        </form>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Star rating ─────────────────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}
        >
          <IconStarFilled
            size={28}
            style={{ color: star <= (hovered || value) ? '#F4631E' : 'rgba(255,255,255,0.12)', transition: 'color 0.1s' }}
          />
        </button>
      ))}
    </div>
  )
}

// ─── Add Files Modal ─────────────────────────────────────────────────────────

interface PendingUpload {
  file: File
  progress: number
  uploaded?: { fileUrl: string; fileName: string; fileType: string }
  error?: string
}

function AddFilesModal({ orderId, onDone, onClose }: { orderId: string; onDone: () => void; onClose: () => void }) {
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(list: FileList | null) {
    if (!list) return
    const newOnes: PendingUpload[] = Array.from(list).map((f) => ({ file: f, progress: 0 }))
    setPending((prev) => [...prev, ...newOnes])
    for (const item of newOnes) {
      try {
        const result = await uploadFile(item.file, 'orders', 'auto', (p) => {
          setPending((prev) => prev.map((x) => (x.file === item.file ? { ...x, progress: p } : x)))
        })
        setPending((prev) =>
          prev.map((x) =>
            x.file === item.file
              ? { ...x, progress: 100, uploaded: { fileUrl: result.secureUrl, fileName: item.file.name, fileType: result.resourceType } }
              : x,
          ),
        )
      } catch (e) {
        setPending((prev) =>
          prev.map((x) => (x.file === item.file ? { ...x, error: e instanceof Error ? e.message : 'Erro no upload' } : x)),
        )
      }
    }
  }

  async function handleSubmit() {
    const ready = pending.filter((p) => p.uploaded).map((p) => p.uploaded!)
    if (ready.length === 0) { setError('Adicione pelo menos um arquivo'); return }
    if (pending.some((p) => !p.uploaded && !p.error)) { setError('Aguarde os uploads terminarem'); return }
    setSubmitting(true)
    setError(null)
    try {
      await addOrderFiles(orderId, ready)
      onDone()
      onClose()
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } }
      setError(err?.response?.data?.message ?? 'Erro ao salvar arquivos')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, background: '#162436',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'white', margin: 0, fontFamily: "'Syne', sans-serif" }}>
              Adicionar arquivos
            </h3>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '3px 0 0' }}>
              Novos arquivos de referência para este pedido
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}>
            <IconX size={18} stroke={1.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Drop zone */}
          <label
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: '28px 16px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.12)', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244,99,30,0.05)'; e.currentTarget.style.borderColor = 'rgba(244,99,30,0.3)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(244,99,30,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconUpload size={18} stroke={1.5} color="#F4631E" />
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, fontWeight: 500 }}>
              Clique ou arraste arquivos aqui
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Vídeos, imagens, PDFs</p>
            <input type="file" multiple className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
              disabled={pending.length >= 10}
            />
          </label>

          {/* File list */}
          {pending.length > 0 && (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
              {pending.map((p) => (
                <li key={p.file.name + p.file.lastModified} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                  borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <IconFile size={14} stroke={1.5} color="rgba(255,255,255,0.4)" />
                  <span style={{ flex: 1, fontSize: 12, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.file.name}
                  </span>
                  <span style={{ fontSize: 11, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
                    color: p.error ? '#EF4444' : p.uploaded ? '#22C55E' : 'rgba(255,255,255,0.4)' }}>
                    {p.error ? p.error : p.uploaded
                      ? <><IconCheck size={10} stroke={2.5} /> ok</>
                      : <><IconLoader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> {p.progress}%</>}
                  </span>
                  <button type="button"
                    onClick={() => setPending((prev) => prev.filter((x) => x.file !== p.file))}
                    style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconX size={10} stroke={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p style={{ fontSize: 12, color: '#FCA5A5', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', margin: 0 }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || pending.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
              borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "'Syne', sans-serif",
              background: pending.length > 0 && !submitting ? '#F4631E' : 'rgba(244,99,30,0.4)',
              color: 'white', border: 'none', cursor: submitting || pending.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? <IconLoader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <IconCheck size={14} stroke={2} />}
            {submitting ? 'Salvando...' : `Adicionar ${pending.filter((p) => p.uploaded).length > 0 ? `(${pending.filter((p) => p.uploaded).length})` : ''}`}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Review form ─────────────────────────────────────────────────────────────

function ReviewFormSection({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) return setError('Selecione uma nota antes de enviar')
    setSubmitting(true)
    setError(null)
    try {
      await createReview(orderId, { rating, comment: comment.trim() || undefined })
      onDone()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao enviar avaliação')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ContentSection title="Avaliar entrega">
      <form onSubmit={handleSubmit}>
        <p className="mb-4 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Pedido concluído! Avalie sua experiência com este editor.
        </p>
        <div className="mb-4">
          <StarRating value={rating} onChange={setRating} />
          {rating > 0 && (
            <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'][rating]}
            </p>
          )}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Deixe um comentário sobre o trabalho (opcional)..."
          rows={3}
          maxLength={2000}
          className="mb-3 w-full rounded-[8px] px-3 py-2.5 text-sm text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
          disabled={submitting}
        />
        {error && <p className="mb-3 text-xs" style={{ color: '#FCA5A5' }}>{error}</p>}
        <button
          type="submit"
          disabled={submitting || !rating}
          className="flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-sm font-semibold"
          style={{
            background: '#F4631E', color: '#fff', border: 'none',
            cursor: submitting || !rating ? 'not-allowed' : 'pointer',
            opacity: submitting || !rating ? 0.6 : 1,
            fontFamily: "'Syne', sans-serif",
          }}
        >
          {submitting && <IconLoader2 size={14} className="animate-spin" />}
          {submitting ? 'Enviando...' : 'Enviar avaliação'}
        </button>
      </form>
    </ContentSection>
  )
}

// ─── Contract section (termos do pedido, aceite de ambas as partes) ───────────

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function printAgreement(content: string, title: string) {
  const w = window.open('', '_blank', 'width=820,height=940')
  if (!w) return
  w.document.write(
    `<!doctype html><html><head><title>${escapeHtml(title)}</title><style>body{font-family:Georgia,'Times New Roman',serif;padding:48px;white-space:pre-wrap;font-size:13px;line-height:1.65;color:#111;max-width:760px;margin:0 auto}</style></head><body>${escapeHtml(content)}</body></html>`,
  )
  w.document.close()
  w.focus()
  w.print()
}

function AcceptanceRow({ label, acceptedAt }: { label: string; acceptedAt: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {acceptedAt ? (
        <IconCircleCheck size={14} stroke={2} style={{ color: '#22C55E' }} />
      ) : (
        <IconClock size={14} stroke={1.5} style={{ color: '#EAB308' }} />
      )}
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
      <span className="ml-auto text-[11px]" style={{ color: acceptedAt ? '#22C55E' : '#EAB308' }}>
        {acceptedAt
          ? `aceito em ${new Date(acceptedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
          : 'aguardando aceite'}
      </span>
    </div>
  )
}

function ContractSection({
  order,
  perspective,
  onRefresh,
}: {
  order: OrderDetailDTO
  perspective: 'creator' | 'editor' | 'admin'
  onRefresh: () => Promise<void>
}) {
  const agreement = order.agreement
  const needsMyAcceptance =
    agreement !== null &&
    perspective !== 'admin' &&
    (perspective === 'creator' ? !agreement.creatorAcceptedAt : !agreement.editorAcceptedAt)

  // Expande automaticamente enquanto falta aceite; depois fica recolhido
  const [expanded, setExpanded] = useState(order.status === 'AWAITING_PAYMENT' && !agreement?.bothAccepted)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!agreement) return null

  async function handleAccept() {
    setAccepting(true)
    setError(null)
    try {
      await acceptAgreement(order.id)
      await onRefresh()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao aceitar os termos')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <div
      className="rounded-[12px] p-5"
      style={{
        background: agreement.bothAccepted ? 'rgba(255,255,255,0.03)' : 'rgba(244,99,30,0.05)',
        border: agreement.bothAccepted ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(244,99,30,0.25)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <IconFileText size={16} stroke={1.5} style={{ color: '#F4631E' }} />
        <h2 className="font-heading text-sm font-semibold text-white">Contrato do projeto</h2>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            background: agreement.bothAccepted ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
            color: agreement.bothAccepted ? '#22C55E' : '#EAB308',
          }}
        >
          {agreement.bothAccepted ? 'Aceito por ambos' : 'Aguardando aceites'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => printAgreement(agreement.content, `Contrato — ${order.title}`)}
            title="Imprimir / Salvar PDF"
            className="flex h-7 w-7 items-center justify-center rounded-[6px]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
          >
            <IconPrinter size={13} stroke={1.5} />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Recolher' : 'Ler contrato'}
            className="flex h-7 w-7 items-center justify-center rounded-[6px]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
          >
            {expanded ? <IconChevronUp size={13} stroke={1.5} /> : <IconChevronDown size={13} stroke={1.5} />}
          </button>
        </div>
      </div>

      {/* Status dos aceites */}
      <div className="mt-3 space-y-1.5 rounded-[8px] px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <AcceptanceRow label={`Criador — ${order.creator.name}`} acceptedAt={agreement.creatorAcceptedAt} />
        <AcceptanceRow label={`Editor — ${order.editor.name}`} acceptedAt={agreement.editorAcceptedAt} />
      </div>

      {/* Conteúdo do contrato */}
      {expanded && (
        <pre
          className="mt-3 max-h-[380px] overflow-y-auto whitespace-pre-wrap rounded-[8px] p-4 text-xs leading-relaxed"
          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontFamily: "'DM Sans', sans-serif", margin: 0 }}
        >
          {agreement.content}
        </pre>
      )}

      {/* Aceite da parte logada */}
      {needsMyAcceptance && (
        <div className="mt-4">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex items-center gap-2 rounded-[8px] px-5 py-2.5 text-sm font-semibold transition-all"
            style={{
              background: '#F4631E', color: 'white', border: 'none',
              cursor: accepting ? 'not-allowed' : 'pointer',
              opacity: accepting ? 0.7 : 1,
              fontFamily: "'Syne', sans-serif",
            }}
          >
            {accepting ? <IconLoader2 size={14} className="animate-spin" /> : <IconCircleCheck size={14} stroke={2} />}
            Li e aceito os termos
          </button>
          <p className="mt-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            O aceite eletrônico é registrado com data e hora (cláusula 12).
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-xs" style={{ color: '#FCA5A5' }}>{error}</p>}
    </div>
  )
}

// ─── Revision request form (creator, on DELIVERED) ────────────────────────────

function RevisionRequestForm({ order, onDone }: { order: OrderDetailDTO; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latestDelivery = order.deliveries[order.deliveries.length - 1] ?? null
  const usedRevisions = order.revisions.length

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!latestDelivery) return setError('Não há entrega para revisar')
    if (!description.trim()) return setError('Descreva o que precisa ser alterado')
    setError(null)
    setConfirmOpen(true)
  }

  async function confirmSubmit() {
    if (!latestDelivery) return
    setSubmitting(true)
    setError(null)
    try {
      await createRevision(order.id, { deliveryId: latestDelivery.id, description: description.trim() })
      setDescription('')
      setConfirmOpen(false)
      setOpen(false)
      await onDone()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setConfirmOpen(false)
      setError(e?.response?.data?.message ?? 'Erro ao solicitar revisão')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-sm font-semibold transition-all"
        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: "'Syne', sans-serif" }}
      >
        <IconRefresh size={14} stroke={1.5} />
        Solicitar revisão
      </button>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="rounded-[12px] p-4 space-y-3" style={{ background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.25)' }}>
        <p className="text-sm font-semibold" style={{ color: '#EAB308' }}>Solicitar revisão</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="O que precisa ser alterado?"
          rows={3}
          maxLength={2000}
          autoFocus
          className="w-full rounded-[8px] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
          disabled={submitting}
        />
        {error && <p className="text-xs" style={{ color: '#FCA5A5' }}>{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null) }}
            className="rounded-[8px] px-3 py-2 text-xs"
            style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !description.trim()}
            className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-xs font-semibold"
            style={{ background: '#EAB308', color: '#1a1400', border: 'none', cursor: submitting || !description.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !description.trim() ? 0.6 : 1, fontFamily: "'Syne', sans-serif" }}
          >
            {submitting && <IconLoader2 size={12} className="animate-spin" />}
            Enviar solicitação
          </button>
        </div>
      </form>

      {/* Confirmação — mostra a rodada de revisão que será usada (2 inclusas) */}
      <Modal
        open={confirmOpen}
        onClose={() => { if (!submitting) setConfirmOpen(false) }}
        title="Confirmar solicitação de revisão"
        subtitle={order.title}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={submitting}
              className="rounded-[8px] px-4 py-2 text-sm"
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmSubmit}
              disabled={submitting}
              className="flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold"
              style={{ background: '#EAB308', color: '#1a1400', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: "'Syne', sans-serif" }}
            >
              {submitting && <IconLoader2 size={14} className="animate-spin" />}
              Solicitar revisão
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Esta será a <strong style={{ color: '#EAB308' }}>{usedRevisions + 1}ª de 2 revisões inclusas</strong> no
          contrato. O editor será notificado para ajustar a entrega.
        </p>
        <div className="mt-3 rounded-[8px] px-3 py-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>O que será solicitado</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{description}</p>
        </div>
      </Modal>
    </>
  )
}

// ─── Dispute form (creator, on DELIVERED / REVISION_REQUESTED) ─────────────────

function DisputeForm({ order, onDone }: { order: OrderDetailDTO; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return setError('Descreva o motivo da disputa')
    setSubmitting(true)
    setError(null)
    try {
      await openDispute(order.id, reason.trim())
      setReason('')
      setOpen(false)
      await onDone()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setError(e?.response?.data?.message ?? 'Erro ao abrir disputa')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium transition-all"
        style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.7)', cursor: 'pointer', padding: '4px 0', fontFamily: "'DM Sans', sans-serif" }}
      >
        <IconGavel size={13} stroke={1.5} />
        Abrir disputa
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[12px] p-4 space-y-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
      <div className="flex items-center gap-2">
        <IconAlertTriangle size={15} stroke={1.5} style={{ color: '#EF4444' }} />
        <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>Abrir disputa</p>
      </div>
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Use apenas se não foi possível resolver com revisões. O pedido será congelado e a CutMakers fará a análise. O pagamento permanece retido até a decisão.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Explique o motivo da disputa..."
        rows={3}
        maxLength={2000}
        autoFocus
        className="w-full rounded-[8px] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', resize: 'vertical', fontFamily: "'DM Sans', sans-serif" }}
        disabled={submitting}
      />
      {error && <p className="text-xs" style={{ color: '#FCA5A5' }}>{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null) }}
          className="rounded-[8px] px-3 py-2 text-xs"
          style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting || !reason.trim()}
          className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-xs font-semibold"
          style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.35)', cursor: submitting || !reason.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !reason.trim() ? 0.6 : 1, fontFamily: "'Syne', sans-serif" }}
        >
          {submitting && <IconLoader2 size={12} className="animate-spin" />}
          Confirmar disputa
        </button>
      </div>
    </form>
  )
}

// ─── Pending revision card (editor sees what to fix) ──────────────────────────

function PendingRevisionCard({ revision }: { revision: RevisionDTO }) {
  return (
    <div className="mb-6 rounded-[12px] p-5" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}>
      <div className="mb-2 flex items-center gap-2">
        <IconRefresh size={16} stroke={1.5} style={{ color: '#EAB308' }} />
        <p className="font-heading text-sm font-semibold" style={{ color: '#EAB308' }}>
          Revisão solicitada na entrega v{revision.deliveryVersion}
        </p>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>{revision.description}</p>
      <p className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        Solicitada em {new Date(revision.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}

// ─── Revision history ─────────────────────────────────────────────────────────

function RevisionHistorySection({ revisions }: { revisions: RevisionDTO[] }) {
  if (revisions.length === 0) return null
  return (
    <ContentSection title={`Histórico de revisões (${revisions.length})`}>
      <ul className="space-y-3">
        {revisions.map((r) => {
          const resolved = r.status === 'ADDRESSED'
          return (
            <li key={r.id} className="rounded-[8px] p-4" style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.18)' }}>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: 'rgba(168,85,247,0.2)', color: '#A855F7' }}>v{r.deliveryVersion}</span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: resolved ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)', color: resolved ? '#22C55E' : '#EAB308' }}>
                  {REVISION_STATUS_LABELS[r.status]}
                </span>
                <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {new Date(r.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{r.description}</p>
            </li>
          )
        })}
      </ul>
    </ContentSection>
  )
}

// ─── Dispute banner ───────────────────────────────────────────────────────────

function DisputeBanner({
  order,
  perspective,
  onResolve,
  resolving,
  resolveError,
}: {
  order: OrderDetailDTO
  perspective: 'creator' | 'editor' | 'admin'
  onResolve: (resolution: DisputeResolution) => Promise<void>
  resolving: DisputeResolution | null
  resolveError: string | null
}) {
  const dispute = order.dispute
  return (
    <div className="mb-6 rounded-[12px] p-5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
      <div className="mb-2 flex items-center gap-2">
        <IconGavel size={18} stroke={1.5} style={{ color: '#EF4444' }} />
        <p className="font-heading text-sm font-bold" style={{ color: '#EF4444' }}>
          Em disputa — aguardando análise da CutMakers
        </p>
      </div>
      {dispute?.reason && (
        <div className="mt-2 rounded-[8px] px-3 py-2" style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.35)' }}>Motivo</p>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{dispute.reason}</p>
        </div>
      )}
      <p className="mt-3 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {perspective === 'admin'
          ? 'Resolva a disputa liberando o pagamento ao editor ou reembolsando o creator. O pagamento está retido em escrow.'
          : 'O pedido está congelado e o pagamento permanece retido em escrow até a decisão da equipe.'}
      </p>

      {perspective === 'admin' && dispute?.status === 'OPEN' && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onResolve('RELEASE')}
            disabled={resolving !== null}
            className="flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-sm font-semibold transition-all"
            style={{ background: '#22C55E', color: 'white', border: 'none', cursor: resolving ? 'not-allowed' : 'pointer', opacity: resolving ? 0.7 : 1, fontFamily: "'Syne', sans-serif" }}
          >
            {resolving === 'RELEASE' ? <IconLoader2 size={14} className="animate-spin" /> : <IconCircleCheck size={14} stroke={2} />}
            Liberar ao editor
          </button>
          <button
            onClick={() => onResolve('REFUND')}
            disabled={resolving !== null}
            className="flex items-center gap-2 rounded-[8px] px-4 py-2.5 text-sm font-semibold transition-all"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', cursor: resolving ? 'not-allowed' : 'pointer', opacity: resolving ? 0.7 : 1, fontFamily: "'Syne', sans-serif" }}
          >
            {resolving === 'REFUND' ? <IconLoader2 size={14} className="animate-spin" /> : <IconArrowLeft size={14} stroke={2} />}
            Reembolsar creator
          </button>
        </div>
      )}
      {resolveError && <p className="mt-3 text-xs" style={{ color: '#FCA5A5' }}>{resolveError}</p>}
    </div>
  )
}

// ─── Action buttons ───────────────────────────────────────────────────────────

function ActionButtons({
  order,
  perspective,
  onAction,
  onRefresh,
}: {
  order: OrderDetailDTO
  perspective: 'creator' | 'editor' | 'admin'
  onAction: (status: OrderStatus) => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [showDelivery, setShowDelivery] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)

  async function doAction(status: OrderStatus) {
    setBusy(status)
    await onAction(status)
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
        background: variant === 'primary' ? '#F4631E' : variant === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.06)',
        color: variant === 'primary' ? 'white' : variant === 'danger' ? '#EF4444' : 'rgba(255,255,255,0.8)',
        border: variant === 'primary' ? 'none' : variant === 'danger' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.1)',
        cursor: busy !== null ? 'not-allowed' : 'pointer',
        opacity: busy !== null ? 0.7 : 1,
        fontFamily: "'Syne', sans-serif",
      }}
    >
      {busy === key ? <IconLoader2 size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  )

  const { status } = order

  // New-flow statuses are handled by their own sections
  if (status === 'NEGOTIATING' || status === 'AWAITING_PAYMENT') return null

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
          {btn('Enviar entrega', () => setShowDelivery(true), 'delivery', 'primary', <IconUpload size={14} stroke={1.5} />)}
          {showDelivery && (
            <DeliveryForm
              orderId={order.id}
              onClose={() => setShowDelivery(false)}
              onDone={async () => { setShowDelivery(false); await onRefresh() }}
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

  if (perspective === 'creator') {
    if (status === 'PENDING') {
      return btn('Cancelar pedido', () => doAction('CANCELLED'), 'CANCELLED', 'danger', <IconX size={14} stroke={2} />)
    }
    if (status === 'ACCEPTED') {
      return btn('Cancelar pedido', () => doAction('CANCELLED'), 'CANCELLED', 'danger', <IconX size={14} stroke={2} />)
    }
    if (status === 'DELIVERED') {
      return (
        <>
          <div className="flex flex-col gap-3">
            {btn('Aprovar entrega', () => setConfirmApprove(true), 'COMPLETED', 'primary', <IconCheck size={14} stroke={2} />)}
            <RevisionRequestForm order={order} onDone={onRefresh} />
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
              <DisputeForm order={order} onDone={onRefresh} />
            </div>
          </div>

          {/* Confirmação de aprovação — ação irreversível: libera o pagamento */}
          <Modal
            open={confirmApprove}
            onClose={() => { if (busy === null) setConfirmApprove(false) }}
            title="Aprovar entrega"
            subtitle={order.title}
            size="sm"
            footer={
              <>
                <button
                  onClick={() => setConfirmApprove(false)}
                  disabled={busy !== null}
                  className="rounded-[8px] px-4 py-2 text-sm"
                  style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)', cursor: busy ? 'not-allowed' : 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => { await doAction('COMPLETED'); setConfirmApprove(false) }}
                  disabled={busy !== null}
                  className="flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold"
                  style={{ background: '#22C55E', color: 'white', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: "'Syne', sans-serif" }}
                >
                  {busy === 'COMPLETED' ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} stroke={2} />}
                  Confirmar aprovação
                </button>
              </>
            }
          >
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Ao aprovar, o pagamento de{' '}
              <strong style={{ color: '#22C55E' }}>{fmtBRL(order.budget - order.platformFee)}</strong>{' '}
              será liberado ao editor e o pedido será concluído.
            </p>
            <p className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Esta ação não pode ser desfeita (cláusula 4a do contrato).
            </p>
          </Modal>
        </>
      )
    }
    if (status === 'REVISION_REQUESTED') {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            O editor foi notificado e irá aplicar a revisão solicitada.
          </p>
          <DisputeForm order={order} onDone={onRefresh} />
        </div>
      )
    }
    return null
  }

  return null
}

// ─── Main component ───────────────────────────────────────────────────────────

interface OrderDetailProps {
  orderId: string
  onBack?: () => void
}

export function OrderDetail({ orderId, onBack }: OrderDetailProps) {
  const { user } = useAuth()
  const [order, setOrder] = useState<OrderDetailDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [resolving, setResolving] = useState<DisputeResolution | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [addFilesOpen, setAddFilesOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [conversation, setConversation] = useState<ConversationDTO | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getOrder(orderId)
      setOrder(data)
      const conv = await getOrCreateConversationByOrder(orderId)
      setConversation(conv)
    } catch {
      setError('Pedido não encontrado ou você não tem acesso.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [orderId])

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
      const updated = await updateOrderStatus(order.id, newStatus)
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
      if (result.paymentUrl) window.open(result.paymentUrl, '_blank')
      await load()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setPayError(e?.response?.data?.message ?? 'Erro ao iniciar pagamento')
    }
  }

  async function handleResolveDispute(resolution: DisputeResolution) {
    if (!order) return
    setResolving(resolution)
    setResolveError(null)
    try {
      await resolveDispute(order.id, resolution)
      await load()
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      setResolveError(e?.response?.data?.message ?? 'Erro ao resolver disputa')
    } finally {
      setResolving(null)
    }
  }

  const statusColor = order ? STATUS_COLORS[order.status] : '#F4631E'
  const counterpart = order ? (perspective === 'creator' ? order.editor : order.creator) : null
  const counterpartLabel = perspective === 'creator' ? 'Editor' : 'Creator'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <IconLoader2 size={28} className="animate-spin" style={{ color: '#F4631E' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[12px] p-6 text-center" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
        <IconAlertCircle size={28} className="mx-auto mb-2" />
        {error}
      </div>
    )
  }

  if (!order) return null

  // Tab definitions per perspective.
  // Para o creator, a aba "Pagamento" só existe até o pagamento ser confirmado;
  // depois o fluxo vira Briefing / Arquivos / Mensagens (entregas + aprovação no Briefing).
  const prePayment = ['NEGOTIATING', 'AWAITING_PAYMENT', 'PENDING', 'ACCEPTED'].includes(order.status)
  const tabs = perspective === 'editor'
    ? [
        { id: 'briefing', label: 'Briefing' },
        { id: 'arquivos', label: 'Arquivos' },
        { id: 'mensagens', label: 'Mensagens' },
      ]
    : prePayment
      ? [
          { id: 'pagamento', label: 'Pagamento' },
          { id: 'briefing', label: 'Briefing & Arquivos' },
          { id: 'mensagens', label: 'Mensagens' },
        ]
      : [
          { id: 'briefing', label: 'Briefing' },
          { id: 'arquivos', label: 'Arquivos' },
          { id: 'mensagens', label: 'Mensagens' },
        ]
  const defaultTab = perspective === 'editor' || !prePayment ? 'briefing' : 'pagamento'
  const requestedTab = activeTab ?? defaultTab
  const currentTab = tabs.some((t) => t.id === requestedTab) ? requestedTab : defaultTab

  return (
    <div>
      {/* Back button + order header */}
      <div className="mb-5 flex items-start gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="mt-1 flex shrink-0 items-center gap-1.5 rounded-[8px] px-3 py-2 text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
          >
            <IconArrowLeft size={14} stroke={1.5} />
            Voltar
          </button>
        )}
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-3">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {order.category.name} · criado em {new Date(order.createdAt).toLocaleDateString('pt-BR')}
            </p>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ background: `${statusColor}1A`, color: statusColor, border: `1px solid ${statusColor}33` }}
            >
              {STATUS_LABELS[order.status]}
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">{order.title}</h1>
        </div>
      </div>

      {/* Stepper — always visible */}
      <StatusStepper order={order} />

      {/* Dispute banner — visible to both parties + admin resolve actions */}
      {order.status === 'DISPUTED' && (
        <DisputeBanner
          order={order}
          perspective={perspective}
          onResolve={handleResolveDispute}
          resolving={resolving}
          resolveError={resolveError}
        />
      )}

      {/* Pending revision — editor sees what to fix, above everything */}
      {perspective === 'editor' &&
        (order.status === 'REVISION_REQUESTED' || order.status === 'IN_PROGRESS') &&
        (() => {
          const pending = order.revisions.find((r) => r.status === 'PENDING')
          return pending ? <PendingRevisionCard revision={pending} /> : null
        })()}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 0 }}>
        {tabs.map((tab) => {
          const active = currentTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer',
                background: 'none', border: 'none', borderBottom: active ? '2px solid #F4631E' : '2px solid transparent',
                color: active ? '#F4631E' : 'rgba(255,255,255,0.5)',
                fontFamily: "'DM Sans', sans-serif", marginBottom: -1, transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── TAB: PAGAMENTO (creator / admin) ── */}
      {currentTab === 'pagamento' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            <ContractSection order={order} perspective={perspective} onRefresh={load} />
            {order.status === 'NEGOTIATING' && (
              <NegotiationSection order={order} perspective={perspective} currentUserId={user.id} onRefresh={load} />
            )}
            {order.status === 'AWAITING_PAYMENT' && (
              <>
                {order.proposals.length > 0 && (
                  <ContentSection title="Negociação (concluída)">
                    <div className="space-y-3">
                      {order.proposals.map((p) => (
                        <ProposalCard key={p.id} proposal={p} order={order} currentUserId={user.id} perspective={perspective} onRefresh={load} />
                      ))}
                    </div>
                  </ContentSection>
                )}
                <AwaitingPaymentSection order={order} perspective={perspective} onPayment={handlePayment} payError={payError} />
              </>
            )}
            {order.status !== 'NEGOTIATING' && order.status !== 'AWAITING_PAYMENT' && order.status !== 'DISPUTED' && (
              <ContentSection title="Ações">
                <ActionButtons order={order} perspective={perspective} onAction={handleAction} onRefresh={load} />
                {actionError && (
                  <div className="mt-3 rounded-[8px] px-4 py-3 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
                    {actionError}
                  </div>
                )}
              </ContentSection>
            )}
          </div>

          <div className="space-y-4">
            {counterpart && (
              <SideCard>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>{counterpartLabel}</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-sm font-bold text-white" style={{ background: avatarBg(counterpart.name) }}>
                    {counterpart.avatarUrl ? <img src={counterpart.avatarUrl} alt={counterpart.name} className="h-full w-full object-cover" /> : counterpart.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-medium text-white">{counterpart.name}</p>
                </div>
              </SideCard>
            )}
            <SideCard>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Financeiro</p>
              <div className="space-y-2">
                <Row label="Orçamento" value={fmtBRL(order.budget)} />
                <Row label="Taxa (10%)" value={fmtBRL(order.platformFee)} muted />
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                  <Row label="Editor recebe" value={fmtBRL(order.budget - order.platformFee)} highlight />
                </div>
                {order.deadline && <Row label="Prazo" value={new Date(order.deadline).toLocaleDateString('pt-BR')} />}
              </div>
            </SideCard>
            <SideCard>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Pagamento</p>
              {order.transaction ? (
                <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-medium" style={{
                  background: order.transaction.status === 'RELEASED' ? 'rgba(34,197,94,0.15)' : order.transaction.status === 'HELD' ? 'rgba(59,130,246,0.15)' : 'rgba(244,99,30,0.15)',
                  color: order.transaction.status === 'RELEASED' ? '#22C55E' : order.transaction.status === 'HELD' ? '#3B82F6' : '#F4631E',
                }}>
                  {TRANSACTION_LABELS[order.transaction.status]}
                </span>
              ) : (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {order.status === 'NEGOTIATING' ? 'Aguardando conclusão da negociação.' : 'Aguardando pagamento.'}
                </p>
              )}
            </SideCard>
          </div>
        </div>
      )}

      {/* ── TAB: BRIEFING (editor only — payment + actions in sidebar) ── */}
      {currentTab === 'briefing' && perspective === 'editor' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            <ContractSection order={order} perspective={perspective} onRefresh={load} />
            {order.status === 'NEGOTIATING' && (
              <NegotiationSection order={order} perspective={perspective} currentUserId={user.id} onRefresh={load} />
            )}
            {order.status === 'AWAITING_PAYMENT' && (
              <AwaitingPaymentSection order={order} perspective={perspective} onPayment={handlePayment} payError={payError} />
            )}
            <ContentSection title="Briefing">
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{order.description}</p>
            </ContentSection>
          </div>
          <div className="space-y-4">
            {counterpart && (
              <SideCard>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>{counterpartLabel}</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-sm font-bold text-white" style={{ background: avatarBg(counterpart.name) }}>
                    {counterpart.avatarUrl ? <img src={counterpart.avatarUrl} alt={counterpart.name} className="h-full w-full object-cover" /> : counterpart.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-medium text-white">{counterpart.name}</p>
                </div>
              </SideCard>
            )}
            <SideCard>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Financeiro</p>
              <div className="space-y-2">
                <Row label="Orçamento" value={fmtBRL(order.budget)} />
                <Row label="Taxa (10%)" value={fmtBRL(order.platformFee)} muted />
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                  <Row label="Editor recebe" value={fmtBRL(order.budget - order.platformFee)} highlight />
                </div>
                {order.deadline && <Row label="Prazo" value={new Date(order.deadline).toLocaleDateString('pt-BR')} />}
              </div>
            </SideCard>
            {order.status !== 'NEGOTIATING' && order.status !== 'AWAITING_PAYMENT' && order.status !== 'DISPUTED' && (
              <SideCard>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Ações</p>
                <ActionButtons order={order} perspective={perspective} onAction={handleAction} onRefresh={load} />
                {actionError && (
                  <div className="mt-3 rounded-[8px] px-4 py-3 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
                    {actionError}
                  </div>
                )}
              </SideCard>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: BRIEFING & ARQUIVOS (creator / admin) ── */}
      {/* Pré-pagamento: Briefing & Arquivos juntos (aba Pagamento cuida do resto) */}
      {currentTab === 'briefing' && perspective !== 'editor' && prePayment && (
        <div className="space-y-6">
          <ContentSection title="Briefing">
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{order.description}</p>
          </ContentSection>

          <ContentSection
            title={`Arquivos de referência${order.files.length > 0 ? ` (${order.files.length})` : ''}`}
            action={
              <button
                onClick={() => setAddFilesOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: 'rgba(244,99,30,0.1)', border: '1px solid rgba(244,99,30,0.25)', color: '#F4631E', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                <IconUpload size={11} stroke={2} />
                Novos arquivos
              </button>
            }
          >
            {order.files.length > 0 ? (
              <ul className="space-y-2">
                {order.files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <IconFile size={16} stroke={1.5} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                    <span className="flex-1 truncate text-white">{f.fileName}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{f.fileType}</span>
                    <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-[6px]" style={{ background: 'rgba(244,99,30,0.1)', color: '#F4631E', textDecoration: 'none' }}>
                      <IconDownload size={13} stroke={1.5} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-1 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhum arquivo adicionado ainda.</p>
            )}
          </ContentSection>
        </div>
      )}

      {/* Pós-pagamento: Briefing vira a aba principal — entregas + aprovação aqui */}
      {currentTab === 'briefing' && perspective !== 'editor' && !prePayment && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-6">
            <ContractSection order={order} perspective={perspective} onRefresh={load} />

            <ContentSection title="Briefing">
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{order.description}</p>
            </ContentSection>

            {order.deliveries.length > 0 && (
              <ContentSection title={`Entregas (${order.deliveries.length})`}>
                <ul className="space-y-3">
                  {order.deliveries.map((d) => (
                    <li key={d.id} className="rounded-[8px] p-4" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: 'rgba(168,85,247,0.2)', color: '#A855F7' }}>v{d.version}</span>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{new Date(d.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {d.message && <p className="mb-3 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{d.message}</p>}
                      <a href={d.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-xs font-medium" style={{ background: 'rgba(168,85,247,0.15)', color: '#A855F7', textDecoration: 'none', border: '1px solid rgba(168,85,247,0.3)' }}>
                        <IconPlayerPlay size={12} stroke={1.5} />
                        Abrir vídeo
                      </a>
                    </li>
                  ))}
                </ul>
              </ContentSection>
            )}

            {/* Ações do creator (aprovar / revisar / disputa) logo abaixo das entregas */}
            {(order.status === 'DELIVERED' || order.status === 'REVISION_REQUESTED') && (
              <ContentSection title="Ações">
                <ActionButtons order={order} perspective={perspective} onAction={handleAction} onRefresh={load} />
                {actionError && (
                  <div className="mt-3 rounded-[8px] px-4 py-3 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
                    {actionError}
                  </div>
                )}
              </ContentSection>
            )}

            <RevisionHistorySection revisions={order.revisions} />

            {order.status === 'COMPLETED' && perspective === 'creator' && (
              order.review ? (
                <ContentSection title="Sua avaliação">
                  <div className="flex items-center gap-2 mb-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <IconStarFilled key={s} size={18} style={{ color: s <= order.review!.rating ? '#F4631E' : 'rgba(255,255,255,0.12)' }} />
                    ))}
                    <span className="text-sm font-semibold text-white ml-1">{order.review.rating}/5</span>
                  </div>
                  {order.review.comment && <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{order.review.comment}</p>}
                  <p className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Avaliado em {new Date(order.review.createdAt).toLocaleDateString('pt-BR')}</p>
                </ContentSection>
              ) : (
                <ReviewFormSection orderId={order.id} onDone={load} />
              )
            )}
          </div>

          {/* Sidebar: contraparte + financeiro + status do pagamento */}
          <div className="space-y-4">
            {counterpart && (
              <SideCard>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>{counterpartLabel}</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full font-heading text-sm font-bold text-white" style={{ background: avatarBg(counterpart.name) }}>
                    {counterpart.avatarUrl ? <img src={counterpart.avatarUrl} alt={counterpart.name} className="h-full w-full object-cover" /> : counterpart.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-medium text-white">{counterpart.name}</p>
                </div>
              </SideCard>
            )}
            <SideCard>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Financeiro</p>
              <div className="space-y-2">
                <Row label="Orçamento" value={fmtBRL(order.budget)} />
                <Row label="Taxa (10%)" value={fmtBRL(order.platformFee)} muted />
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                  <Row label="Editor recebe" value={fmtBRL(order.budget - order.platformFee)} highlight />
                </div>
                {order.deadline && <Row label="Prazo" value={new Date(order.deadline).toLocaleDateString('pt-BR')} />}
              </div>
            </SideCard>
            <SideCard>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.4)' }}>Pagamento</p>
              {order.transaction ? (
                <span className="inline-block rounded-full px-2.5 py-1 text-[11px] font-medium" style={{
                  background: order.transaction.status === 'RELEASED' ? 'rgba(34,197,94,0.15)' : order.transaction.status === 'HELD' ? 'rgba(59,130,246,0.15)' : 'rgba(244,99,30,0.15)',
                  color: order.transaction.status === 'RELEASED' ? '#22C55E' : order.transaction.status === 'HELD' ? '#3B82F6' : '#F4631E',
                }}>
                  {TRANSACTION_LABELS[order.transaction.status]}
                </span>
              ) : (
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Sem transação registrada.</p>
              )}
            </SideCard>
          </div>
        </div>
      )}

      {/* ── TAB: ARQUIVOS (creator/admin, pós-pagamento) ── */}
      {currentTab === 'arquivos' && perspective !== 'editor' && (
        <div className="space-y-6">
          <ContentSection
            title={`Arquivos de referência${order.files.length > 0 ? ` (${order.files.length})` : ''}`}
            action={
              order.status !== 'COMPLETED' && order.status !== 'CANCELLED' ? (
                <button
                  onClick={() => setAddFilesOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: 'rgba(244,99,30,0.1)', border: '1px solid rgba(244,99,30,0.25)', color: '#F4631E', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  <IconUpload size={11} stroke={2} />
                  Novos arquivos
                </button>
              ) : undefined
            }
          >
            {order.files.length > 0 ? (
              <ul className="space-y-2">
                {order.files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <IconFile size={16} stroke={1.5} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                    <span className="flex-1 truncate text-white">{f.fileName}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{f.fileType}</span>
                    <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-[6px]" style={{ background: 'rgba(244,99,30,0.1)', color: '#F4631E', textDecoration: 'none' }}>
                      <IconDownload size={13} stroke={1.5} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-1 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhum arquivo adicionado ainda.</p>
            )}
          </ContentSection>
        </div>
      )}

      {/* ── TAB: ARQUIVOS (editor only) ── */}
      {currentTab === 'arquivos' && perspective === 'editor' && (
        <div className="space-y-6">
          <ContentSection title={`Arquivos de referência${order.files.length > 0 ? ` (${order.files.length})` : ''}`}>
            {order.files.length > 0 ? (
              <ul className="space-y-2">
                {order.files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <IconFile size={16} stroke={1.5} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                    <span className="flex-1 truncate text-white">{f.fileName}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{f.fileType}</span>
                    <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-[6px]" style={{ background: 'rgba(244,99,30,0.1)', color: '#F4631E', textDecoration: 'none' }}>
                      <IconDownload size={13} stroke={1.5} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-1 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhum arquivo adicionado ainda.</p>
            )}
          </ContentSection>

          {order.deliveries.length > 0 && (
            <ContentSection title={`Suas entregas (${order.deliveries.length})`}>
              <ul className="space-y-3">
                {order.deliveries.map((d) => (
                  <li key={d.id} className="rounded-[8px] p-4" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: 'rgba(168,85,247,0.2)', color: '#A855F7' }}>v{d.version}</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{new Date(d.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {d.message && <p className="mb-3 text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{d.message}</p>}
                    <a href={d.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-[6px] px-3 py-1.5 text-xs font-medium" style={{ background: 'rgba(168,85,247,0.15)', color: '#A855F7', textDecoration: 'none', border: '1px solid rgba(168,85,247,0.3)' }}>
                      <IconPlayerPlay size={12} stroke={1.5} />
                      Abrir vídeo
                    </a>
                  </li>
                ))}
              </ul>
            </ContentSection>
          )}

          <RevisionHistorySection revisions={order.revisions} />
        </div>
      )}

      {/* ── TAB: MENSAGENS ── */}
      {currentTab === 'mensagens' && (
        <div className="overflow-hidden rounded-[12px]" style={{ border: '1px solid rgba(255,255,255,0.08)', height: 'calc(100vh - 320px)', minHeight: 400 }}>
          {conversation
            ? <ChatPanel conversation={conversation} compact={false} />
            : <div className="flex h-full items-center justify-center text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Carregando conversa...</div>
          }
        </div>
      )}

      {addFilesOpen && (
        <AddFilesModal orderId={order.id} onDone={load} onClose={() => setAddFilesOpen(false)} />
      )}
    </div>
  )
}
