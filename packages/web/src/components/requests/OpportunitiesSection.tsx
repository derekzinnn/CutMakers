import { useCallback, useEffect, useState } from 'react'
import {
  IconSearch,
  IconBriefcase,
  IconUsers,
  IconLink,
  IconSend,
  IconEdit,
  IconArrowBackUp,
  IconRefresh,
} from '@tabler/icons-react'
import { Modal } from '@/components/ui/Modal'
import { useCategories } from '@/hooks/use-categories'
import {
  listOpenRequests,
  getRequest,
  withdrawMyRequestProposal,
  errorMessage,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_COLORS,
  type BoardRequest,
  type EditorRequestDetail,
} from '@/lib/requests'
import { ProposalFormModal } from './ProposalFormModal'
import {
  Avatar,
  Empty,
  ErrorBox,
  GhostButton,
  Loading,
  Pager,
  Pill,
  PrimaryButton,
  budgetLabel,
  deadlineLabel,
  fmtBRL,
  fmtDate,
} from './shared'

// ─── Quadro de oportunidades (editor) ─────────────────────────────────────────

export function OpportunitiesSection({ initialRequestId }: { initialRequestId?: string | null }) {
  const { categories } = useCategories()
  const [category, setCategory] = useState('')
  const [rawSearch, setRawSearch] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent' | 'budget_desc'>('recent')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ requests: BoardRequest[]; totalPages: number; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(initialRequestId ?? null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [rawSearch])

  useEffect(() => { setPage(1) }, [category, search, sort])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listOpenRequests({
        category: category || undefined,
        search: search || undefined,
        sort,
        page,
      })
      setData({ requests: res.requests, totalPages: res.totalPages, total: res.total })
    } catch {
      setData({ requests: [], totalPages: 1, total: 0 })
    } finally {
      setLoading(false)
    }
  }, [category, search, sort, page])

  useEffect(() => { load() }, [load])

  const selectStyle: React.CSSProperties = {
    background: 'var(--surface-subtle)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    colorScheme: 'dark',
  }

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-[8px] px-3 py-2" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
          <IconSearch size={14} stroke={1.5} style={{ color: 'var(--muted-foreground)' }} />
          <input
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            placeholder="Buscar por título ou descrição..."
            className="w-64 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-[8px] px-3 py-2 text-xs outline-none" style={selectStyle}>
          <option value="" style={{ background: 'var(--card)' }}>Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} style={{ background: 'var(--card)' }}>{c.name}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'budget_desc')} className="rounded-[8px] px-3 py-2 text-xs outline-none" style={selectStyle}>
          <option value="recent" style={{ background: 'var(--card)' }}>Mais recentes</option>
          <option value="budget_desc" style={{ background: 'var(--card)' }}>Maior orçamento</option>
        </select>
        <button
          onClick={load}
          title="Atualizar"
          className="flex h-8 w-8 items-center justify-center rounded-[8px]"
          style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}
        >
          <IconRefresh size={14} stroke={1.5} />
        </button>
        {data && (
          <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {data.total} oportunidade{data.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading && !data ? (
        <Loading />
      ) : !data || data.requests.length === 0 ? (
        <Empty
          icon={<IconBriefcase size={26} stroke={1.5} color="var(--brand)" />}
          title="Nenhuma oportunidade no momento"
          text="Quando criadores publicarem projetos nas suas categorias, eles aparecem aqui. Tente outros filtros."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {data.requests.map((r) => (
              <OpportunityCard key={r.id} request={r} onOpen={() => setOpenId(r.id)} />
            ))}
          </div>
          <Pager page={page} totalPages={data.totalPages} onPage={setPage} />
        </>
      )}

      <OpportunityDetailModal requestId={openId} onClose={() => setOpenId(null)} onChanged={load} />
    </div>
  )
}

function OpportunityCard({ request: r, onOpen }: { request: BoardRequest; onOpen: () => void }) {
  const dl = deadlineLabel(r.deadline)
  return (
    <div
      className="flex flex-col rounded-[12px] p-5"
      style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Pill label={r.category.name} color="var(--muted-foreground)" />
        {dl && <span className="text-[11px]" style={{ color: dl.color }}>{dl.text}</span>}
        <span className="ml-auto text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{fmtDate(r.createdAt)}</span>
      </div>
      <h3 className="font-heading text-base font-semibold text-white">{r.title}</h3>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{r.descriptionPreview}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <span className="font-semibold text-white">{budgetLabel(r.budgetMin, r.budgetMax)}</span>
        <span className="inline-flex items-center gap-1">
          <IconUsers size={12} stroke={1.5} />
          {r.proposalCount === 0
            ? 'Seja o primeiro a propor'
            : `${r.proposalCount} editor${r.proposalCount > 1 ? 'es' : ''} já propuse${r.proposalCount > 1 ? 'ram' : 'u'}`}
        </span>
        <span>{r.revisionsIncluded} revis{r.revisionsIncluded === 1 ? 'ão' : 'ões'}</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <Avatar name={r.creator.name} url={r.creator.avatarUrl} size={22} />
          {r.creator.name}
        </span>
        {r.myProposal ? (
          <button onClick={onOpen} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Pill label={`Proposta ${PROPOSAL_STATUS_LABELS[r.myProposal.status].toLowerCase()}`} color={PROPOSAL_STATUS_COLORS[r.myProposal.status]} />
          </button>
        ) : (
          <PrimaryButton onClick={onOpen}>
            <IconSend size={14} stroke={2} /> Enviar proposta
          </PrimaryButton>
        )}
      </div>
    </div>
  )
}

// ─── Detalhe da oportunidade (descrição completa + links + proposta própria) ──

export function OpportunityDetailModal({
  requestId,
  onClose,
  onChanged,
}: {
  requestId: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [request, setRequest] = useState<EditorRequestDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!requestId) return
    setLoading(true)
    setError(null)
    try {
      const res = await getRequest(requestId)
      if (res.perspective === 'editor') setRequest(res.request)
      else setError('Esta é uma solicitação sua — acompanhe em "Minhas solicitações" no painel de criador.')
    } catch (err) {
      setError(errorMessage(err, 'Solicitação não encontrada ou já encerrada'))
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    setRequest(null)
    setConfirmWithdraw(false)
    load()
  }, [load])

  async function withdraw() {
    if (!request) return
    setBusy(true)
    setError(null)
    try {
      await withdrawMyRequestProposal(request.id)
      setConfirmWithdraw(false)
      await load()
      onChanged()
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível retirar a proposta'))
    } finally {
      setBusy(false)
    }
  }

  const mine = request?.myProposal ?? null
  const isOpen = request?.status === 'OPEN'
  const canPropose = isOpen && (!mine || mine.status === 'WITHDRAWN')
  const canEdit = isOpen && mine?.status === 'PENDING'

  return (
    <>
      <Modal
        open={requestId !== null && !formOpen}
        onClose={onClose}
        title={request?.title ?? 'Oportunidade'}
        subtitle={request ? `${request.category.name} · publicada por ${request.creator.name}` : undefined}
        size="lg"
        footer={
          request ? (
            <>
              {canEdit && !confirmWithdraw && (
                <>
                  <GhostButton danger onClick={() => setConfirmWithdraw(true)}><IconArrowBackUp size={13} stroke={1.5} /> Retirar proposta</GhostButton>
                  <PrimaryButton onClick={() => setFormOpen(true)}><IconEdit size={14} stroke={2} /> Editar proposta</PrimaryButton>
                </>
              )}
              {confirmWithdraw && (
                <>
                  <GhostButton onClick={() => setConfirmWithdraw(false)} disabled={busy}>Manter proposta</GhostButton>
                  <PrimaryButton tone="red" busy={busy} onClick={withdraw}>Confirmar retirada</PrimaryButton>
                </>
              )}
              {canPropose && (
                <PrimaryButton onClick={() => setFormOpen(true)}><IconSend size={14} stroke={2} /> Enviar proposta</PrimaryButton>
              )}
              {!canPropose && !canEdit && <GhostButton onClick={onClose}>Fechar</GhostButton>}
            </>
          ) : undefined
        }
      >
        {loading && !request ? (
          <Loading />
        ) : error && !request ? (
          <ErrorBox message={error} />
        ) : request ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {!isOpen && <Pill label={REQUEST_STATUS_LABELS[request.status]} color={REQUEST_STATUS_COLORS[request.status]} />}
              <span className="text-sm font-semibold text-white">{budgetLabel(request.budgetMin, request.budgetMax)}</span>
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                · Prazo: {request.deadline ? new Date(request.deadline).toLocaleDateString('pt-BR') : 'a combinar'}
                · {request.revisionsIncluded} revis{request.revisionsIncluded === 1 ? 'ão inclusa' : 'ões inclusas'}
                · {request.proposalCount} proposta{request.proposalCount !== 1 ? 's' : ''}
              </span>
            </div>

            <div>
              <h4 className="mb-1.5 font-heading text-sm font-semibold text-white">Descrição</h4>
              <p className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{request.description}</p>
            </div>

            {request.referenceLinks.length > 0 && (
              <div>
                <h4 className="mb-1.5 font-heading text-sm font-semibold text-white">Referências</h4>
                <div className="space-y-1.5">
                  {request.referenceLinks.map((link) => (
                    <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 truncate text-xs hover:underline" style={{ color: 'var(--brand)' }}>
                      <IconLink size={12} stroke={1.5} /> {link}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              Arquivos brutos do criador são liberados apenas ao editor escolhido, após a confirmação do pagamento.
            </p>

            {mine && mine.status !== 'WITHDRAWN' && (
              <div className="rounded-[10px] p-4" style={{ background: 'var(--brand-soft)', border: '1px solid var(--brand-border)' }}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>Sua proposta</span>
                  <Pill label={PROPOSAL_STATUS_LABELS[mine.status]} color={PROPOSAL_STATUS_COLORS[mine.status]} />
                </div>
                <p className="text-sm text-white">
                  <strong>{fmtBRL(mine.amount)}</strong>
                  <span style={{ color: 'var(--muted-foreground)' }}> · entrega em {mine.deliveryDays} dia{mine.deliveryDays !== 1 ? 's' : ''}</span>
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>{mine.message}</p>
              </div>
            )}

            {confirmWithdraw && (
              <p className="text-xs" style={{ color: 'var(--destructive)' }}>
                Ao retirar, sua proposta deixa de ser considerada. Você poderá enviar outra enquanto a solicitação estiver aberta.
              </p>
            )}
            <ErrorBox message={error} />
          </div>
        ) : null}
      </Modal>

      {request && (
        <ProposalFormModal
          open={formOpen}
          requestId={request.id}
          requestTitle={request.title}
          budgetMin={request.budgetMin}
          budgetMax={request.budgetMax}
          existing={canEdit ? mine : null}
          onClose={() => setFormOpen(false)}
          onSaved={() => { load(); onChanged() }}
        />
      )}
    </>
  )
}
