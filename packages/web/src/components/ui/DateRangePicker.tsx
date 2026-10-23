import { useEffect, useMemo, useRef, useState } from 'react'
import { IconCalendar, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import {
  MONTHS_LONG,
  PRESETS,
  formatRange,
  formatYmd,
  fromYmd,
  previousPeriod,
  presetRange,
  toYmd,
  type DateRangeValue,
  type Ymd,
} from '@/lib/date-range'

/**
 * Seletor de período no padrão do Meta Ads: atalhos à esquerda (com os usados recentemente
 * no topo), dois meses lado a lado, opção "Comparar" e Cancelar/Atualizar. Nada muda na tela
 * até "Atualizar" — dá para explorar o calendário sem disparar requisição a cada clique.
 */

interface Props {
  value: DateRangeValue
  compare: boolean
  onApply: (value: DateRangeValue, compare: boolean) => void
}

const RECENT_KEY = 'cm_range_recent'
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function readRecent(): DateRangeValue[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as DateRangeValue[]).slice(0, 3) : []
  } catch {
    return []
  }
}

function saveRecent(v: DateRangeValue) {
  try {
    const rest = readRecent().filter((r) => !(r.from === v.from && r.to === v.to))
    localStorage.setItem(RECENT_KEY, JSON.stringify([v, ...rest].slice(0, 3)))
  } catch {
    /* sem storage: só não lembra */
  }
}

/** Primeiro dia do mês, como 'AAAA-MM-01' */
const monthStart = (y: number, m: number): Ymd => toYmd(new Date(y, m, 1, 12))

function Month({
  year,
  month,
  today,
  from,
  to,
  hover,
  onPick,
  onHover,
}: {
  year: number
  month: number
  today: Ymd
  from: Ymd
  to: Ymd | null
  hover: Ymd | null
  onPick: (d: Ymd) => void
  onHover: (d: Ymd | null) => void
}) {
  const first = new Date(year, month, 1, 12)
  const offset = (first.getDay() + 6) % 7
  const total = new Date(year, month + 1, 0).getDate()
  // enquanto o 2º clique não acontece, o fim "provisório" é o dia sob o mouse
  const end = to ?? (hover && hover >= from ? hover : from)

  const cells: (Ymd | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: total }, (_, i) => toYmd(new Date(year, month, i + 1, 12))),
  ]

  return (
    <div role="grid" aria-label={`${MONTHS_LONG[month]} de ${year}`}>
      <div className="grid grid-cols-7 text-center text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1.5">{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7" onMouseLeave={() => onHover(null)}>
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const future = d > today
          const isStart = d === from
          const isEnd = d === end
          const inside = d > from && d < end
          const edge = isStart || isEnd
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              disabled={future}
              aria-selected={edge || inside}
              aria-label={formatYmd(d)}
              onClick={() => onPick(d)}
              onMouseEnter={() => onHover(d)}
              className="relative h-9 text-[13px]"
              style={{
                background: inside || (edge && from !== end) ? 'var(--brand-soft)' : 'transparent',
                borderRadius:
                  isStart && from !== end ? '8px 0 0 8px' : isEnd && from !== end ? '0 8px 8px 0' : inside ? 0 : 8,
                color: future ? 'var(--muted-foreground)' : 'var(--foreground)',
                opacity: future ? 0.4 : 1,
                cursor: future ? 'not-allowed' : 'pointer',
                border: 'none',
                fontWeight: d === today ? 700 : 400,
              }}
            >
              {edge && (
                <span
                  className="absolute inset-0.5 flex items-center justify-center rounded-[7px]"
                  style={{ background: 'var(--brand)', color: 'var(--brand-foreground)' }}
                >
                  {Number(d.slice(8))}
                </span>
              )}
              <span style={{ visibility: edge ? 'hidden' : 'visible' }}>{Number(d.slice(8))}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MonthHeader({
  year,
  month,
  maxYear,
  onChange,
}: {
  year: number
  month: number
  maxYear: number
  onChange: (y: number, m: number) => void
}) {
  const sel = {
    background: 'transparent',
    color: 'var(--foreground)',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    colorScheme: 'dark',
  } as const
  const years = Array.from({ length: maxYear - 2023 + 1 }, (_, i) => 2023 + i)
  return (
    <div className="flex items-center justify-center gap-1">
      <select
        aria-label="Mês"
        value={month}
        onChange={(e) => onChange(year, Number(e.target.value))}
        style={sel}
      >
        {MONTHS_LONG.map((m, i) => (
          <option key={m} value={i} style={{ background: 'var(--card)' }}>{m.slice(0, 3)}</option>
        ))}
      </select>
      <select aria-label="Ano" value={year} onChange={(e) => onChange(Number(e.target.value), month)} style={sel}>
        {years.map((y) => (
          <option key={y} value={y} style={{ background: 'var(--card)' }}>{y}</option>
        ))}
      </select>
    </div>
  )
}

export function DateRangePicker({ value, compare, onApply }: Props) {
  const today = toYmd(new Date())
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Rascunho: só vira valor de verdade em "Atualizar"
  const [draft, setDraft] = useState<{ from: Ymd; to: Ymd | null; preset: string | null }>({
    from: value.from,
    to: value.to,
    preset: value.preset,
  })
  const [draftCompare, setDraftCompare] = useState(compare)
  const [hover, setHover] = useState<Ymd | null>(null)
  const [view, setView] = useState(() => {
    const d = fromYmd(value.from)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const recent = useMemo(() => (open ? readRecent() : []), [open])

  function openPicker() {
    setDraft({ from: value.from, to: value.to, preset: value.preset })
    setDraftCompare(compare)
    // mostra o mês do fim do período no mês da direita (como no Meta)
    const end = fromYmd(value.to)
    const left = new Date(end.getFullYear(), end.getMonth() - 1, 1)
    const startsSameMonth = value.from.slice(0, 7) === value.to.slice(0, 7)
    setView(
      startsSameMonth
        ? { y: end.getFullYear(), m: end.getMonth() }
        : { y: left.getFullYear(), m: left.getMonth() },
    )
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(d: Ymd) {
    // 1º clique abre um período novo; 2º fecha (invertendo se foi antes do início)
    if (draft.to !== null) {
      setDraft({ from: d, to: null, preset: null })
      return
    }
    const [a, b] = d < draft.from ? [d, draft.from] : [draft.from, d]
    setDraft({ from: a, to: b, preset: null })
  }

  function pickPreset(id: string) {
    const r = presetRange(id, today)
    if (!r) return
    setDraft({ from: r.from, to: r.to, preset: id })
    const end = fromYmd(r.to)
    const left = new Date(end.getFullYear(), end.getMonth() - 1, 1)
    setView({ y: left.getFullYear(), m: left.getMonth() })
  }

  function pickRecent(r: DateRangeValue) {
    setDraft({ from: r.from, to: r.to, preset: r.preset })
    const end = fromYmd(r.to)
    const left = new Date(end.getFullYear(), end.getMonth() - 1, 1)
    setView({ y: left.getFullYear(), m: left.getMonth() })
  }

  function shiftView(delta: number) {
    const d = new Date(view.y, view.m + delta, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }

  function apply() {
    const to = draft.to ?? draft.from
    const next: DateRangeValue = { from: draft.from, to, preset: draft.preset }
    if (!draft.preset) saveRecent(next)
    onApply(next, draftCompare)
    setOpen(false)
  }

  const right = new Date(view.y, view.m + 1, 1)
  const label = value.preset ? PRESETS.find((p) => p.id === value.preset)?.label : null
  const draftTo = draft.to ?? draft.from
  const prev = previousPeriod(draft.from, draftTo)
  const maxYear = new Date().getFullYear()
  const canGoNext = monthStart(right.getFullYear(), right.getMonth()) < today.slice(0, 7) + '-01'

  const radio = (active: boolean) => (
    <span
      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
      style={{ border: `1.5px solid ${active ? 'var(--brand)' : 'var(--input)'}` }}
    >
      {active && <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--brand)' }} />}
    </span>
  )
  const presetBtn = (key: string, text: string, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className="hover-surface flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm"
      style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}
    >
      {radio(active)}
      {text}
    </button>
  )

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="hover-surface flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
        style={{
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}
      >
        <IconCalendar size={15} stroke={1.5} />
        {label && <strong style={{ fontWeight: 600 }}>{label}:</strong>}
        <span>{formatRange(value.from, value.to)}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Selecionar período"
          className="anim-scale-in absolute right-0 top-[calc(100%+8px)] z-40 flex max-h-[calc(100dvh-7rem)] w-[min(calc(100vw-2rem),400px)] flex-col overflow-hidden rounded-xl shadow-2xl xl:w-[820px] xl:flex-row"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', transformOrigin: 'top right' }}
        >
          {/* Atalhos */}
          <div
            className="max-h-48 shrink-0 overflow-y-auto p-3 xl:max-h-none xl:w-[220px]"
            style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
          >
            {recent.length > 0 && (
              <>
                <p className="px-2 pb-1 pt-1 text-sm font-semibold">Usados recentemente</p>
                {recent.map((r) =>
                  presetBtn(
                    `r-${r.from}-${r.to}`,
                    r.preset ? (PRESETS.find((p) => p.id === r.preset)?.label ?? formatRange(r.from, r.to)) : formatRange(r.from, r.to),
                    draft.from === r.from && draftTo === r.to && draft.preset === r.preset,
                    () => pickRecent(r),
                  ),
                )}
                <div className="my-2" style={{ borderTop: '1px solid var(--border)' }} />
              </>
            )}
            {PRESETS.map((p) => presetBtn(p.id, p.label, draft.preset === p.id, () => pickPreset(p.id)))}
          </div>

          {/* Calendários + rodapé */}
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-5">
            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <div className="mb-2 grid grid-cols-[32px_1fr_32px] items-center xl:grid-cols-[32px_1fr]">
                  <button
                    type="button"
                    aria-label="Mês anterior"
                    onClick={() => shiftView(-1)}
                    className="hover-surface flex h-8 w-8 items-center justify-center rounded-md"
                    style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: 'pointer' }}
                  >
                    <IconChevronLeft size={18} stroke={1.5} />
                  </button>
                  <MonthHeader year={view.y} month={view.m} maxYear={maxYear} onChange={(y, m) => setView({ y, m })} />
                  <button
                    type="button"
                    aria-label="Próximo mês"
                    onClick={() => shiftView(1)}
                    disabled={!canGoNext}
                    className="hover-surface flex h-8 w-8 items-center justify-center rounded-md xl:hidden"
                    style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: canGoNext ? 'pointer' : 'not-allowed', opacity: canGoNext ? 1 : 0.4 }}
                  >
                    <IconChevronRight size={18} stroke={1.5} />
                  </button>
                </div>
                <Month year={view.y} month={view.m} today={today} from={draft.from} to={draft.to} hover={hover} onPick={pick} onHover={setHover} />
              </div>

              <div className="hidden xl:block">
                <div className="mb-2 grid grid-cols-[1fr_32px] items-center">
                  <MonthHeader
                    year={right.getFullYear()}
                    month={right.getMonth()}
                    maxYear={maxYear}
                    onChange={(y, m) => {
                      const d = new Date(y, m - 1, 1)
                      setView({ y: d.getFullYear(), m: d.getMonth() })
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Próximo mês"
                    onClick={() => shiftView(1)}
                    disabled={!canGoNext}
                    className="hover-surface flex h-8 w-8 items-center justify-center rounded-md"
                    style={{ background: 'transparent', border: 'none', color: 'var(--foreground)', cursor: canGoNext ? 'pointer' : 'not-allowed', opacity: canGoNext ? 1 : 0.4 }}
                  >
                    <IconChevronRight size={18} stroke={1.5} />
                  </button>
                </div>
                <Month year={right.getFullYear()} month={right.getMonth()} today={today} from={draft.from} to={draft.to} hover={hover} onPick={pick} onHover={setHover} />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={draftCompare}
                  onChange={(e) => setDraftCompare(e.target.checked)}
                  className="h-[18px] w-[18px]"
                  style={{ accentColor: 'var(--brand)' }}
                />
                Comparar com o período anterior
              </label>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="rounded-md px-3 py-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface-subtle)' }}
                >
                  {formatYmd(draft.from)}
                </span>
                <span style={{ color: 'var(--muted-foreground)' }}>–</span>
                <span
                  className="rounded-md px-3 py-2"
                  style={{ border: '1px solid var(--border)', background: 'var(--surface-subtle)', opacity: draft.to ? 1 : 0.5 }}
                >
                  {formatYmd(draftTo)}
                </span>
              </div>

              {draftCompare && (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  Período anterior: {formatYmd(prev.from)} – {formatYmd(prev.to)}
                </p>
              )}
            </div>

            <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-6">
              <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                Fuso horário das datas: Horário de Brasília
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="hover-surface rounded-lg px-4 py-2 text-sm font-medium"
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{ background: 'var(--brand)', border: 'none', color: 'var(--brand-foreground)', cursor: 'pointer' }}
                >
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

