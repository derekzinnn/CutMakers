import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconBriefcase,
  IconCheck,
  IconChevronRight,
  IconCoin,
  IconTrendingUp,
  IconUserPlus,
  IconArrowUpRight,
  IconArrowDownRight,
  IconAlertTriangle,
} from '@tabler/icons-react'
import { useCached } from '@/hooks/use-cached'
import { usePersistedState } from '@/hooks/use-persisted-state'
import { getDashboard, type DashboardData, type DashboardTotals, type UserRole } from '@/lib/admin'
import { formatMoney } from '@/lib/format'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/orders'
import { formatYmd, presetRange, toYmd, type DateRangeValue } from '@/lib/date-range'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { Skeleton, SkeletonStats } from '@/components/ui/Skeleton'

const ROLE_LABELS: Record<UserRole, string> = { CREATOR: 'Criador', EDITOR: 'Editor', BOTH: 'Ambos', ADMIN: 'Admin' }

const DEFAULT_RANGE: DateRangeValue = { from: '', to: '', preset: 'this_month' }

type SeriesKey = 'users' | 'orders' | 'revenue'
const SERIES: { key: SeriesKey; label: string; money?: boolean }[] = [
  { key: 'orders', label: 'Pedidos criados' },
  { key: 'users', label: 'Novos usuários' },
  { key: 'revenue', label: 'Receita da plataforma', money: true },
]

/** Variação % entre período atual e anterior. null = sem base de comparação (anterior = 0) */
function variation(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return ((cur - prev) / prev) * 100
}

function Delta({ cur, prev, money }: { cur: number; prev: number; money?: boolean }) {
  const pct = variation(cur, prev)
  const prevText = money ? formatMoney(prev) : String(prev)
  if (pct === null) {
    return (
      <p className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        {cur > 0 ? 'Novo no período' : 'Sem movimento'} · antes: {prevText}
      </p>
    )
  }
  const up = pct >= 0
  const color = pct === 0 ? 'var(--muted-foreground)' : up ? 'var(--success)' : 'var(--destructive)'
  const Arrow = up ? IconArrowUpRight : IconArrowDownRight
  return (
    <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
      <span className="flex items-center font-semibold" style={{ color }}>
        {pct !== 0 && <Arrow size={13} stroke={2} />}
        {Math.abs(pct).toFixed(pct % 1 === 0 ? 0 : 1)}%
      </span>
      · antes: {prevText}
    </p>
  )
}

function StatCard({
  label,
  value,
  Icon,
  delta,
}: {
  label: string
  value: string
  Icon: React.ElementType
  delta?: React.ReactNode
}) {
  return (
    <div className="rounded-card p-5" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--brand-soft)' }}>
          <Icon size={16} stroke={1.5} color="var(--brand)" />
        </span>
      </div>
      <p className="font-heading text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{value}</p>
      {delta}
    </div>
  )
}

/** Gráfico de área em SVG puro (sem dependência). Hover mostra o valor do dia. */
function AreaChart({ points, money }: { points: { date: string; value: number }[]; money?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  // Largura medida do painel: o viewBox acompanha os pixels reais. Com 800 fixo o SVG escalava pela
  // altura e ficava centralizado, sobrando faixa vazia dos dois lados em telas largas.
  const boxRef = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(800)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const medir = () => setW(Math.max(280, Math.round(el.clientWidth)))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const H = 220
  const pad = { l: 8, r: 8, t: 12, b: 24 }
  const max = Math.max(1, ...points.map((p) => p.value))
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4
  const x = (i: number) => pad.l + (points.length <= 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r))
  const y = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`
  const fmt = (v: number) => (money ? formatMoney(v) : String(v))
  const labelIdx = points.length <= 8 ? points.map((_, i) => i) : [0, Math.floor(points.length / 3), Math.floor((2 * points.length) / 3), points.length - 1]
  const hp = hover !== null ? points[hover] : null

  return (
    <div ref={boxRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[220px] w-full"
        role="img"
        aria-label="Gráfico por dia"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const rel = ((e.clientX - r.left) / r.width) * W
          const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (points.length - 1))
          setHover(Math.min(points.length - 1, Math.max(0, i)))
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={pad.l} x2={W - pad.r} y1={y(niceMax * t)} y2={y(niceMax * t)} stroke="var(--border)" strokeWidth="1" />
        ))}
        <path d={area} fill="var(--brand-soft)" />
        <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && hp && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(hp.value)} r="4.5" fill="var(--brand)" stroke="var(--card)" strokeWidth="2" />
          </>
        )}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--muted-foreground)">
            {points[i].date.slice(8)}/{points[i].date.slice(5, 7)}
          </text>
        ))}
      </svg>
      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute top-1 rounded-md px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${hover > points.length / 2 ? '-110%' : '10%'})`,
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <p style={{ color: 'var(--muted-foreground)' }}>{formatYmd(hp.date)}</p>
          <p className="font-semibold">{fmt(hp.value)}</p>
        </div>
      )}
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-card p-6" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

const linkBtn = {
  color: 'var(--brand)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
} as const

export function DashboardSection({ onNavigate }: { onNavigate: (section: 'users' | 'orders') => void }) {
  const [stored, setStored] = usePersistedState<DateRangeValue>('admin:range', DEFAULT_RANGE)
  const [compare, setCompare] = usePersistedState('admin:compare', true)
  const [seriesKey, setSeriesKey] = useState<SeriesKey>('orders')

  // Atalhos ("Últimos 7 dias") são recalculados a cada abertura: o valor guardado é o ATALHO,
  // não as datas — senão "últimos 7 dias" ficaria congelado no dia em que foi escolhido.
  const range = useMemo(() => {
    if (stored.preset) {
      const r = presetRange(stored.preset, toYmd(new Date()))
      if (r) return { ...r, preset: stored.preset }
    }
    if (stored.from && stored.to) return stored
    const r = presetRange('this_month', toYmd(new Date()))!
    return { ...r, preset: 'this_month' }
  }, [stored])

  const { dado: data, carregando, erro, recarregar } = useCached<DashboardData>(
    `admin-dashboard:${range.from}:${range.to}`,
    () => getDashboard(range.from, range.to),
  )

  const cur: DashboardTotals | undefined = data?.current
  const prev: DashboardTotals | undefined = data?.previous
  const seriesCfg = SERIES.find((s) => s.key === seriesKey)!
  const points = (data?.series ?? []).map((d) => ({ date: d.date, value: d[seriesKey] }))
  const periodTotal = points.reduce((a, p) => a + p.value, 0)
  const statusMax = Math.max(1, ...(data?.ordersByStatus ?? []).map((s) => s.count))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {data ? `${data.range.days} ${data.range.days === 1 ? 'dia' : 'dias'} analisados` : 'Carregando…'}
          {compare && ' · comparando com o período anterior'}
        </p>
        <DateRangePicker
          value={range}
          compare={compare}
          onApply={(v, c) => {
            setStored(v)
            setCompare(c)
          }}
        />
      </div>

      {erro && !data && (
        <div className="flex items-center justify-between gap-3 rounded-card p-5" style={{ background: 'var(--destructive-soft)', border: '1px solid var(--destructive-border)' }}>
          <span className="flex items-center gap-2 text-sm"><IconAlertTriangle size={16} /> Não foi possível carregar o dashboard.</span>
          <button type="button" onClick={() => void recarregar()} style={linkBtn}>Tentar de novo</button>
        </div>
      )}

      {carregando && !data ? (
        <>
          <SkeletonStats count={5} />
          <Skeleton className="h-64 w-full" />
        </>
      ) : (
        data &&
        cur &&
        prev && (
          <>
            {/* Métricas do período */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
              <StatCard label="Novos usuários" value={String(cur.newUsers)} Icon={IconUserPlus} delta={compare && <Delta cur={cur.newUsers} prev={prev.newUsers} />} />
              <StatCard label="Pedidos criados" value={String(cur.ordersCreated)} Icon={IconBriefcase} delta={compare && <Delta cur={cur.ordersCreated} prev={prev.ordersCreated} />} />
              <StatCard label="Pedidos concluídos" value={String(cur.ordersCompleted)} Icon={IconCheck} delta={compare && <Delta cur={cur.ordersCompleted} prev={prev.ordersCompleted} />} />
              <StatCard label="Receita da plataforma" value={formatMoney(cur.platformRevenue)} Icon={IconTrendingUp} delta={compare && <Delta money cur={cur.platformRevenue} prev={prev.platformRevenue} />} />
              <StatCard label="Volume transacionado" value={formatMoney(cur.volume)} Icon={IconCoin} delta={compare && <Delta money cur={cur.volume} prev={prev.volume} />} />
            </div>

            {/* Gráfico por dia */}
            <Panel
              title={seriesCfg.label}
              action={
                <div className="flex gap-1" role="tablist">
                  {SERIES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      role="tab"
                      aria-selected={s.key === seriesKey}
                      onClick={() => setSeriesKey(s.key)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium"
                      style={{
                        background: s.key === seriesKey ? 'var(--brand-soft)' : 'transparent',
                        color: s.key === seriesKey ? 'var(--brand)' : 'var(--muted-foreground)',
                        border: `1px solid ${s.key === seriesKey ? 'var(--brand-border)' : 'transparent'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              }
            >
              <p className="mb-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                Total no período: <strong style={{ color: 'var(--foreground)' }}>{seriesCfg.money ? formatMoney(periodTotal) : periodTotal}</strong>
              </p>
              <AreaChart points={points} money={seriesCfg.money} />
            </Panel>

            {/* Retrato de agora (não depende do período) */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[
                { label: 'Usuários cadastrados', value: String(data.snapshot.totalUsers) },
                { label: 'Pedidos em andamento', value: String(data.snapshot.activeOrders) },
                { label: 'Disputas abertas', value: String(data.snapshot.openDisputes), alert: data.snapshot.openDisputes > 0 },
                { label: 'Em custódia (escrow)', value: formatMoney(data.snapshot.heldInEscrow) },
                { label: 'Assinantes premium', value: String(data.snapshot.activeSubscribers) },
              ].map((s) => (
                <div key={s.label} className="rounded-card px-4 py-3" style={{ background: 'var(--surface-subtle)', border: `1px solid ${s.alert ? 'var(--brand-border)' : 'var(--border)'}` }}>
                  <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{s.label} · agora</p>
                  <p className="mt-1 font-heading text-lg font-bold" style={{ color: s.alert ? 'var(--brand)' : 'var(--foreground)' }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Pedidos por status (criados no período)">
                {data.ordersByStatus.length === 0 ? (
                  <p className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Nenhum pedido criado neste período.</p>
                ) : (
                  <div className="space-y-3">
                    {[...data.ordersByStatus].sort((a, b) => b.count - a.count).map((s) => (
                      <div key={s.status}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span>{STATUS_LABELS[s.status]}</span>
                          <span style={{ color: 'var(--muted-foreground)' }}>{s.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-raised)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(s.count / statusMax) * 100}%`, background: STATUS_COLORS[s.status] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel
                title="Últimos usuários"
                action={<button type="button" onClick={() => onNavigate('users')} className="flex items-center gap-1" style={linkBtn}>Ver todos <IconChevronRight size={12} /></button>}
              >
                {data.recentUsers.length === 0 ? (
                  <p className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Ninguém se cadastrou neste período.</p>
                ) : (
                  <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {data.recentUsers.map((u) => (
                      <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{u.name}</p>
                          <p className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>{u.email}</p>
                        </div>
                        <div className="shrink-0 text-right text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          <p>{ROLE_LABELS[u.role]}</p>
                          <p>{new Date(u.createdAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <Panel
              title="Últimos pedidos"
              action={<button type="button" onClick={() => onNavigate('orders')} className="flex items-center gap-1" style={linkBtn}>Ver todos <IconChevronRight size={12} /></button>}
            >
              {data.recentOrders.length === 0 ? (
                <p className="py-6 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>Nenhum pedido criado neste período.</p>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {data.recentOrders.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{o.title}</p>
                        <p className="truncate text-xs" style={{ color: 'var(--muted-foreground)' }}>{o.creatorName} → {o.editorName}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-xs">
                        <span style={{ color: STATUS_COLORS[o.status] }}>{STATUS_LABELS[o.status]}</span>
                        <span className="font-semibold">{formatMoney(o.budget)}</span>
                        <span style={{ color: 'var(--muted-foreground)' }}>{new Date(o.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )
      )}
    </div>
  )
}

