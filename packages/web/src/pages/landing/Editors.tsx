import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconRosetteDiscountCheckFilled, IconStarFilled } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { formatMoney } from '@/lib/format'
import { useCached } from '@/hooks/use-cached'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { SectionHead } from './SectionHead'

interface EditorCard {
  id: string
  userId: string
  name: string
  avatarUrl: string | null
  isPremium: boolean
  verified: boolean
  avgRating: number
  totalJobs: number
  categories: { id: string; name: string }[]
  portfolioPreview: { id: string; thumbnailUrl: string | null; basePrice: number }[]
}

const LIMIT = 4

function EditorsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Carregando editores">
      {Array.from({ length: LIMIT }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Editores de verdade, vindos de GET /editors (rota pública, mesma ordenação do
 * feed). A landing antiga tinha quatro editores inventados. Se a API falhar ou
 * ainda não houver editores, a seção some em vez de mostrar vazio.
 */
export function Editors({ onRegister }: { onRegister: () => void }) {
  const navigate = useNavigate()
  const { dado, carregando, erro } = useCached<EditorCard[]>('landing:editors', async () => {
    const { data } = await api.get<{ editors: EditorCard[] }>('/editors', { params: { limit: LIMIT } })
    return data.editors
  })

  if (erro || (!carregando && (!dado || dado.length === 0))) return null

  return (
    <section id="editores" className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <SectionHead
          eyebrow="Editores"
          title={<>Veja o trabalho antes de falar com alguém.</>}
          aside={
            <button
              type="button"
              onClick={onRegister}
              className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-md border border-border bg-surface-raised px-5 font-heading text-sm font-semibold text-foreground transition-colors hover:bg-background lg:self-auto"
            >
              Ver todos os editores <IconArrowRight size={15} stroke={2.2} />
            </button>
          }
        />

        {carregando || !dado ? (
          <EditorsSkeleton />
        ) : (
          <div className="anim-stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {dado.map((e) => {
              const thumb = e.portfolioPreview.find((p) => p.thumbnailUrl)?.thumbnailUrl
              const prices = e.portfolioPreview.map((p) => p.basePrice).filter((p) => p > 0)
              const from = prices.length ? Math.min(...prices) : null
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => navigate(`/editors/${e.userId}`)}
                  className="lp-editor flex flex-col overflow-hidden rounded-xl border border-border bg-background text-left"
                >
                  <div className="lp-texture relative aspect-[16/10] w-full bg-surface">
                    {thumb && <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    {e.isPremium && (
                      <span className="absolute right-2.5 top-2.5 rounded-md bg-background px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-brand">
                        PREMIUM
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} url={e.avatarUrl} size={36} />
                      <div className="min-w-0">
                        <span className="flex items-center gap-1.5 font-heading text-sm font-bold text-foreground">
                          <span className="truncate">{e.name}</span>
                          {e.verified && (
                            <IconRosetteDiscountCheckFilled size={14} className="shrink-0 text-brand" aria-label="Verificado" />
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {e.categories.map((c) => c.name).join(' · ') || 'Edição de vídeo'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                      <span>
                        {from !== null ? (
                          <>
                            desde <b className="font-semibold text-foreground">{formatMoney(from)}</b>
                          </>
                        ) : (
                          'Preço sob proposta'
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        {e.totalJobs > 0 ? (
                          <>
                            <IconStarFilled size={12} className="text-brand" />
                            <span className="font-semibold text-foreground">{e.avgRating.toFixed(1)}</span>
                            <span>· {e.totalJobs}</span>
                          </>
                        ) : (
                          'Novo'
                        )}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
