import { SkeletonList } from '@/components/ui/Skeleton'
import { useCallback, useEffect, useState } from 'react'
import { IconSend, IconExternalLink } from '@tabler/icons-react'
import {
  listMyProposals,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  type MyProposal,
} from '@/lib/requests'
import { OpportunityDetailModal } from './OpportunitiesSection'
import {
  Empty,
  GhostButton,
  Pager,
  Pill,
  PrimaryButton,
  fmtBRL,
  fmtDate,
} from './shared'

// ─── Minhas propostas (editor) ────────────────────────────────────────────────

export function MyProposalsSection({
  onBrowse,
  onOpenOrder,
}: {
  onBrowse: () => void
  onOpenOrder: (orderId: string) => void
}) {
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ proposals: MyProposal[]; totalPages: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [openRequestId, setOpenRequestId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listMyProposals(page)
      setData({ proposals: res.proposals, totalPages: res.totalPages })
    } catch {
      setData({ proposals: [], totalPages: 1 })
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  if (loading && !data) return <SkeletonList rows={5} />

  if (!data || data.proposals.length === 0) {
    return (
      <Empty
        icon={<IconSend size={24} stroke={1.5} color="var(--brand)" />}
        title="Você ainda não enviou propostas"
        text="Explore as oportunidades abertas e envie sua proposta para os projetos que combinam com você."
        action={<PrimaryButton onClick={onBrowse}>Ver oportunidades</PrimaryButton>}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[12px]" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
        <div
          className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 text-xs font-medium"
          style={{ color: 'var(--muted-foreground)', background: 'var(--surface-subtle)', borderBottom: '1px solid var(--border)' }}
        >
          <span>Solicitação</span>
          <span>Valor</span>
          <span>Status</span>
          <span>Enviada</span>
          <span className="text-right">Ação</span>
        </div>
        {data.proposals.map((p) => (
          <div
            key={p.id}
            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-center gap-4 px-5 py-3.5 text-sm"
            style={{ borderBottom: '1px solid var(--surface-subtle)' }}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium text-white">{p.request.title}</span>
              <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                {p.request.category.name} · {p.request.creatorName}
              </span>
            </span>
            <span className="font-heading font-semibold text-white">{fmtBRL(p.amount)}</span>
            <span><Pill label={PROPOSAL_STATUS_LABELS[p.status]} color={PROPOSAL_STATUS_COLORS[p.status]} /></span>
            <span style={{ color: 'var(--muted-foreground)' }}>{fmtDate(p.createdAt)}</span>
            <span className="flex justify-end">
              {p.status === 'ACCEPTED' && p.orderId ? (
                <PrimaryButton onClick={() => onOpenOrder(p.orderId!)}>
                  <IconExternalLink size={13} stroke={2} /> Pedido
                </PrimaryButton>
              ) : (
                <GhostButton onClick={() => setOpenRequestId(p.request.id)}>
                  {p.status === 'PENDING' && p.request.status === 'OPEN' ? 'Editar / retirar' : 'Detalhes'}
                </GhostButton>
              )}
            </span>
          </div>
        ))}
      </div>
      <Pager page={page} totalPages={data.totalPages} onPage={setPage} />

      <OpportunityDetailModal requestId={openRequestId} onClose={() => setOpenRequestId(null)} onChanged={load} />
    </div>
  )
}
