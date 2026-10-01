import { useCallback, useEffect, useState } from 'react'
import {
  IconArrowLeft,
  IconPlus,
  IconFileDescription,
  IconEdit,
  IconBan,
  IconLink,
  IconClock,
  IconCheck,
  IconX,
  IconRosetteDiscountCheckFilled,
  IconExternalLink,
  IconUsers,
} from '@tabler/icons-react'
import { Modal } from '@/components/ui/Modal'
import {
  listMyRequests,
  getRequest,
  cancelRequest,
  acceptRequestProposal,
  rejectRequestProposal,
  errorMessage,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  PLATFORM_FEE_RATE,
  type MyRequest,
  type CreatorRequestDetail,
  type CreatorProposal,
} from '@/lib/requests'
import { RequestFormModal } from './RequestFormModal'
import {
  Avatar,
  Empty,
  ErrorBox,
  GhostButton,
  Loading,
  Pager,
  Pill,
  PrimaryButton,
  Stars,
  budgetLabel,
  deadlineLabel,
  fmtBRL,
  fmtDate,
} from './shared'

interface Props {
  /** Abre direto o detalhe (ex.: vindo de uma notificação) */
  initialRequestId?: string | null
  onOpenOrder: (orderId: string) => void
  onOpenEditor: (editorUserId: string) => void
  /** Avisa o dashboard para recalcular o badge da navegação */
  onChanged: () => void
}

export function CreatorRequestsSection({ initialRequestId, onOpenOrder, onOpenEditor, onChanged }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialRequestId ?? null)
  const [formOpen, setFormOpen] = useState(false)
  const [listKey, setListKey] = useState(0)

  useEffect(() => {
    if (initialRequestId) setSelectedId(initialRequestId)
  }, [initialRequestId])

  return (
    <>
      {selectedId ? (
        <RequestDetail
          requestId={selectedId}
          onBack={() => { setSelectedId(null); setListKey((k) => k + 1) }}
          onOpenOrder={onOpenOrder}
          onOpenEditor={onOpenEditor}
          onChanged={onChanged}
        />
      ) : (
        <RequestList key={listKey} onSelect={setSelectedId} onNew={() => setFormOpen(true)} />
      )}

      <RequestFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(id) => { onChanged(); setSelectedId(id) }}
      />
    </>
  )
}

// ─── Lista ────────────────────────────────────────────────────────────────────

function RequestList({ onSelect, onNew }: { onSelect: (id: string) => void; onNew: () => void }) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ requests: MyRequest[]; totalPages: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    listMyRequests(page)
      .then((res) => { if (alive) setData({ requests: res.requests, totalPages: res.totalPages }) })
      .catch(() => { if (alive) setData({ requests: [], totalPages: 1 }) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [page])

  const newButton = (
    <PrimaryButton onClick={onNew}>
      <IconPlus size={15} stroke={2} /> Nova solicitação
    </PrimaryButton>
  )

  if (loading && !data) return <Loading />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Publique um projeto e deixe os editores enviarem propostas. Você escolhe a melhor.
        </p>
        {newButton}
      </div>

      {!data || data.requests.length === 0 ? (
        <Empty
          icon={<IconFileDescription size={26} stroke={1.5} color="#F4631E" />}
          title="Nenhuma solicitação ainda"
          text="Descreva o que precisa, defina uma faixa de orçamento e receba propostas de editores verificados."
          action={newButton}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {data.requests.map((r) => {
              const dl = r.status === 'OPEN' ? deadlineLabel(r.deadline) : null
              return (
                <button
                  key={r.id}
                  onClick={() => onSelect(r.id)}
                  className="rounded-[12px] p-5 text-left transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(244,99,30,0.35)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Pill label={r.category.name} color="#94A3B8" />
                    <Pill label={REQUEST_STATUS_LABELS[r.status]} color={REQUEST_STATUS_COLORS[r.status]} />
                    {r.pendingProposalCount > 0 && r.status === 'OPEN' && (
                      <span
                        className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: '#F4631E', color: 'white' }}
                      >
                        {r.pendingProposalCount} nova{r.pendingProposalCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <h3 className="truncate font-heading text-base font-semibold text-white">{r.title}</h3>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <span>{budgetLabel(r.budgetMin, r.budgetMax)}</span>
                    <span className="inline-flex items-center gap-1">
                      <IconUsers size={12} stroke={1.5} />
                      {r.proposalCount} proposta{r.proposalCount !== 1 ? 's' : ''}
                    </span>
                    <span>Criada em {fmtDate(r.createdAt)}</span>
                    {dl && <span style={{ color: dl.color }}>{dl.text}</span>}
                  </div>
                </button>
              )
            })}
          </div>
          <Pager page={page} totalPages={data.totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}

// ─── Detalhe ──────────────────────────────────────────────────────────────────

function RequestDetail({
  requestId,
  onBack,
  onOpenOrder,
  onOpenEditor,
  onChanged,
}: {
  requestId: string
  onBack: () => void
  onOpenOrder: (orderId: string) => void
  onOpenEditor: (editorUserId: string) => void
  onChanged: () => void
}) {
  const [sort, setSort] = useState<'amount' | 'rating'>('amount')
  const [request, setRequest] = useState<CreatorRequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [acceptTarget, setAcceptTarget] = useState<CreatorProposal | null>(null)
  const [rejectTarget, setRejectTarget] = useState<CreatorProposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getRequest(requestId, sort)
      if (res.perspective === 'creator') setRequest(res.request)
      else setLoadError('Esta solicitação não pertence a você.')
    } catch (err) {
      setLoadError(errorMessage(err, 'Solicitação não encontrada'))
    } finally {
      setLoading(false)
    }
  }, [requestId, sort])

  useEffect(() => { load() }, [load])

  async function runAction(fn: () => Promise<void>) {
    setBusy(true)
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      setActionError(errorMessage(err, 'Não foi possível concluir a ação'))
    } finally {
      setBusy(false)
    }
  }

  const backButton = (
    <button
      onClick={onBack}
      className="flex items-center gap-1.5 rounded-[8px] px-3 py-2 text-sm"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
    >
      <IconArrowLeft size={14} stroke={1.5} /> Voltar
    </button>
  )

  if (loading && !request) return <Loading />
  if (loadError || !request) {
    return (
      <div className="space-y-4">
        {backButton}
        <ErrorBox message={loadError ?? 'Solicitação não encontrada'} />
      </div>
    )
  }

  const isOpen = request.status === 'OPEN'
  const dl = isOpen ? deadlineLabel(request.deadline) : null

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start gap-3">
        {backButton}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Pill label={request.category.name} color="#94A3B8" />
            <Pill label={REQUEST_STATUS_LABELS[request.status]} color={REQUEST_STATUS_COLORS[request.status]} />
            {dl && <span className="text-xs" style={{ color: dl.color }}>{dl.text}</span>}
          </div>
          <h2 className="font-heading text-xl font-bold text-white">{request.title}</h2>
        </div>
        {isOpen && (
          <div className="flex gap-2">
            <GhostButton onClick={() => setEditOpen(true)}><IconEdit size={13} stroke={1.5} /> Editar</GhostButton>
            <GhostButton danger onClick={() => setCancelOpen(true)}><IconBan size={13} stroke={1.5} /> Cancelar solicitação</GhostButton>
          </div>
        )}
        {request.orderId && (
          <PrimaryButton onClick={() => onOpenOrder(request.orderId!)}>
            <IconExternalLink size={14} stroke={2} /> Ver pedido
          </PrimaryButton>
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <div className="rounded-[12px] p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="mb-2 font-heading text-sm font-semibold text-white">Descrição</h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{request.description}</p>
          {request.referenceLinks.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {request.referenceLinks.map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 truncate text-xs hover:underline"
                  style={{ color: '#F4631E' }}
                >
                  <IconLink size={12} stroke={1.5} /> {link}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2 rounded-[12px] p-5 text-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <SummaryRow label="Orçamento" value={budgetLabel(request.budgetMin, request.budgetMax)} />
          <SummaryRow label="Prazo" value={request.deadline ? new Date(request.deadline).toLocaleDateString('pt-BR') : 'A combinar'} />
          <SummaryRow label="Revisões inclusas" value={String(request.revisionsIncluded)} />
          <SummaryRow label="Propostas" value={String(request.proposalCount)} />
        </div>
      </div>

      {/* Propostas */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-white">Propostas recebidas</h3>
          <div className="flex gap-1 rounded-[8px] p-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['amount', 'rating'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className="rounded-[6px] px-3 py-1 text-xs"
                style={{
                  background: sort === s ? 'rgba(244,99,30,0.15)' : 'transparent',
                  color: sort === s ? '#F4631E' : 'rgba(255,255,255,0.5)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {s === 'amount' ? 'Menor preço' : 'Melhor avaliação'}
              </button>
            ))}
          </div>
        </div>

        <ErrorBox message={actionError} />

        {request.proposals.length === 0 ? (
          <Empty
            icon={<IconClock size={24} stroke={1.5} color="#F4631E" />}
            title="Aguardando propostas"
            text={isOpen ? 'Editores da categoria já podem ver sua solicitação. Você será notificado a cada nova proposta.' : 'Nenhuma proposta foi recebida.'}
          />
        ) : (
          <div className="mt-3 space-y-3">
            {request.proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                canDecide={isOpen && p.status === 'PENDING'}
                busy={busy}
                onAccept={() => setAcceptTarget(p)}
                onReject={() => setRejectTarget(p)}
                onOpenEditor={() => onOpenEditor(p.editor.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editar */}
      <RequestFormModal
        open={editOpen}
        initial={request}
        onClose={() => setEditOpen(false)}
        onSaved={() => { load(); onChanged() }}
      />

      {/* Cancelar */}
      <Modal
        open={cancelOpen}
        onClose={() => { if (!busy) setCancelOpen(false) }}
        title="Cancelar solicitação"
        subtitle={request.title}
        size="sm"
        footer={
          <>
            <GhostButton onClick={() => setCancelOpen(false)} disabled={busy}>Voltar</GhostButton>
            <PrimaryButton
              tone="red"
              busy={busy}
              onClick={() => runAction(async () => {
                await cancelRequest(request.id)
                setCancelOpen(false)
                onChanged()
                await load()
              })}
            >
              Cancelar solicitação
            </PrimaryButton>
          </>
        }
      >
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          A solicitação sai do quadro de oportunidades e todas as propostas pendentes
          {request.proposals.filter((p) => p.status === 'PENDING').length > 0
            ? ` (${request.proposals.filter((p) => p.status === 'PENDING').length})`
            : ''}{' '}
          serão encerradas, com aviso aos editores. Esta ação não pode ser desfeita.
        </p>
      </Modal>

      {/* Aceitar */}
      <Modal
        open={acceptTarget !== null}
        onClose={() => { if (!busy) setAcceptTarget(null) }}
        title="Aceitar proposta"
        subtitle={acceptTarget ? `${acceptTarget.editor.name} · ${acceptTarget.deliveryDays} dias` : undefined}
        size="sm"
        footer={
          <>
            <GhostButton onClick={() => setAcceptTarget(null)} disabled={busy}>Voltar</GhostButton>
            <PrimaryButton
              tone="green"
              busy={busy}
              onClick={() => acceptTarget && runAction(async () => {
                const res = await acceptRequestProposal(request.id, acceptTarget.id)
                setAcceptTarget(null)
                onChanged()
                onOpenOrder(res.orderId)
              })}
            >
              <IconCheck size={14} stroke={2} /> Confirmar e criar pedido
            </PrimaryButton>
          </>
        }
      >
        {acceptTarget && (
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-[8px] px-4 py-3" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <SummaryRow label="Você paga" value={fmtBRL(acceptTarget.amount)} strong />
              <SummaryRow
                label="Plataforma retém (10%)"
                value={fmtBRL(Math.round(acceptTarget.amount * PLATFORM_FEE_RATE * 100) / 100)}
              />
              <SummaryRow
                label="Editor recebe"
                value={fmtBRL(acceptTarget.amount - Math.round(acceptTarget.amount * PLATFORM_FEE_RATE * 100) / 100)}
              />
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              O pedido é criado já com o preço acordado. Em seguida, você e o editor aceitam o
              contrato e o pagamento fica retido em escrow até a aprovação da entrega. As demais
              propostas pendentes serão encerradas automaticamente.
            </p>
          </div>
        )}
      </Modal>

      {/* Recusar */}
      <Modal
        open={rejectTarget !== null}
        onClose={() => { if (!busy) setRejectTarget(null) }}
        title="Recusar proposta"
        subtitle={rejectTarget?.editor.name}
        size="sm"
        footer={
          <>
            <GhostButton onClick={() => setRejectTarget(null)} disabled={busy}>Voltar</GhostButton>
            <PrimaryButton
              tone="red"
              busy={busy}
              onClick={() => rejectTarget && runAction(async () => {
                await rejectRequestProposal(request.id, rejectTarget.id)
                setRejectTarget(null)
                onChanged()
                await load()
              })}
            >
              <IconX size={14} stroke={2} /> Recusar
            </PrimaryButton>
          </>
        }
      >
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          O editor será avisado. Sua solicitação continua aberta para outras propostas.
        </p>
      </Modal>
    </div>
  )
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      <span className={strong ? 'font-heading text-sm font-bold text-white' : 'text-sm text-white'}>{value}</span>
    </div>
  )
}

function ProposalCard({
  proposal,
  canDecide,
  busy,
  onAccept,
  onReject,
  onOpenEditor,
}: {
  proposal: CreatorProposal
  canDecide: boolean
  busy: boolean
  onAccept: () => void
  onReject: () => void
  onOpenEditor: () => void
}) {
  const { editor } = proposal
  return (
    <div
      className="rounded-[12px] p-5"
      style={{
        background: proposal.status === 'ACCEPTED' ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${proposal.status === 'ACCEPTED' ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
        opacity: proposal.status === 'REJECTED' ? 0.6 : 1,
      }}
    >
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={editor.name} url={editor.avatarUrl} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-sm font-semibold text-white">{editor.name}</span>
            {editor.isPremium && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'rgba(244,99,30,0.15)', color: '#F4631E' }}>
                <IconRosetteDiscountCheckFilled size={11} /> PREMIUM
              </span>
            )}
            {proposal.status !== 'PENDING' && (
              <Pill label={PROPOSAL_STATUS_LABELS[proposal.status]} color={PROPOSAL_STATUS_COLORS[proposal.status]} />
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <Stars rating={editor.avgRating} />
            <span>{editor.totalJobs} trabalho{editor.totalJobs !== 1 ? 's' : ''}</span>
            <button
              onClick={onOpenEditor}
              className="hover:underline"
              style={{ background: 'none', border: 'none', color: '#F4631E', cursor: 'pointer', padding: 0, fontSize: 12 }}
            >
              Ver perfil
            </button>
          </div>
        </div>
        <div className="text-right">
          <p className="font-heading text-lg font-bold text-white">{fmtBRL(proposal.amount)}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            entrega em {proposal.deliveryDays} dia{proposal.deliveryDays !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{proposal.message}</p>

      {canDecide && (
        <div className="mt-4 flex gap-2">
          <PrimaryButton tone="green" onClick={onAccept} disabled={busy}>
            <IconCheck size={14} stroke={2} /> Aceitar
          </PrimaryButton>
          <GhostButton danger onClick={onReject} disabled={busy}>
            <IconX size={13} stroke={2} /> Recusar
          </GhostButton>
        </div>
      )}
    </div>
  )
}
