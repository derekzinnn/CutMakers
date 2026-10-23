/**
 * Datas do date-picker. Tudo em 'AAAA-MM-DD' (string) — é o formato que a API recebe e
 * evita a armadilha de `new Date('2026-10-01')`, que é meia-noite UTC e vira 30/set no Brasil.
 * Para fazer conta, as strings viram Date ao MEIO-DIA local.
 */

export type Ymd = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toYmd(d: Date): Ymd {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromYmd(s: Ymd): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(s: Ymd, n: number): Ymd {
  const d = fromYmd(s)
  d.setDate(d.getDate() + n)
  return toYmd(d)
}

export function diffDays(a: Ymd, b: Ymd): number {
  return Math.round((fromYmd(b).getTime() - fromYmd(a).getTime()) / 86_400_000)
}

export interface DateRangeValue {
  from: Ymd
  to: Ymd
  /** id do atalho (ex.: 'last7') — permite recalcular "últimos 7 dias" em outro dia */
  preset: string | null
}

export interface RangePreset {
  id: string
  label: string
  resolve: (today: Ymd) => { from: Ymd; to: Ymd }
}

/** Segunda-feira da semana de `s` (a semana do calendário começa na segunda, como no Meta) */
function mondayOf(s: Ymd): Ymd {
  const dow = (fromYmd(s).getDay() + 6) % 7 // seg=0 … dom=6
  return addDays(s, -dow)
}

function firstOfMonth(s: Ymd): Ymd {
  return `${s.slice(0, 7)}-01`
}

function endOfMonth(s: Ymd): Ymd {
  const d = fromYmd(firstOfMonth(s))
  d.setMonth(d.getMonth() + 1, 0)
  return toYmd(d)
}

/**
 * Atalhos iguais aos do Meta Ads. "Últimos N dias" termina ONTEM (o dia de hoje está
 * incompleto e distorceria a comparação); "Hoje e ontem" e "Esta semana/mês" incluem hoje.
 */
export const PRESETS: RangePreset[] = [
  { id: 'today', label: 'Hoje', resolve: (t) => ({ from: t, to: t }) },
  { id: 'yesterday', label: 'Ontem', resolve: (t) => ({ from: addDays(t, -1), to: addDays(t, -1) }) },
  { id: 'today_yesterday', label: 'Hoje e ontem', resolve: (t) => ({ from: addDays(t, -1), to: t }) },
  { id: 'last7', label: 'Últimos 7 dias', resolve: (t) => ({ from: addDays(t, -7), to: addDays(t, -1) }) },
  { id: 'last14', label: 'Últimos 14 dias', resolve: (t) => ({ from: addDays(t, -14), to: addDays(t, -1) }) },
  { id: 'last28', label: 'Últimos 28 dias', resolve: (t) => ({ from: addDays(t, -28), to: addDays(t, -1) }) },
  { id: 'last30', label: 'Últimos 30 dias', resolve: (t) => ({ from: addDays(t, -30), to: addDays(t, -1) }) },
  { id: 'this_week', label: 'Esta semana', resolve: (t) => ({ from: mondayOf(t), to: t }) },
  {
    id: 'last_week',
    label: 'Semana passada',
    resolve: (t) => {
      const mon = addDays(mondayOf(t), -7)
      return { from: mon, to: addDays(mon, 6) }
    },
  },
  { id: 'this_month', label: 'Este mês', resolve: (t) => ({ from: firstOfMonth(t), to: t }) },
  {
    id: 'last_month',
    label: 'Mês passado',
    resolve: (t) => {
      const prevLast = addDays(firstOfMonth(t), -1)
      return { from: firstOfMonth(prevLast), to: endOfMonth(prevLast) }
    },
  },
]

export function presetRange(id: string, today: Ymd): { from: Ymd; to: Ymd } | null {
  return PRESETS.find((p) => p.id === id)?.resolve(today) ?? null
}

/** Período anterior de mesmo tamanho, imediatamente antes de `from` */
export function previousPeriod(from: Ymd, to: Ymd): { from: Ymd; to: Ymd } {
  const days = diffDays(from, to) + 1
  return { from: addDays(from, -days), to: addDays(from, -1) }
}

const MONTHS_SHORT = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
export const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** '1 de out. de 2026' */
export function formatYmd(s: Ymd): string {
  const d = fromYmd(s)
  return `${d.getDate()} de ${MONTHS_SHORT[d.getMonth()]} de ${d.getFullYear()}`
}

/** '29 de set. – 1 de out. de 2026' (ano só no fim quando é o mesmo) */
export function formatRange(from: Ymd, to: Ymd): string {
  if (from === to) return formatYmd(from)
  const a = fromYmd(from)
  const b = fromYmd(to)
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} de ${MONTHS_SHORT[a.getMonth()]} – ${formatYmd(to)}`
  }
  return `${formatYmd(from)} – ${formatYmd(to)}`
}
