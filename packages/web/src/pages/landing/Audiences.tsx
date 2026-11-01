import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { IconArrowRight, IconCheck } from '@tabler/icons-react'
import { formatMoney } from '@/lib/format'
import { AUDIENCES, AUTO_APPROVE_DAYS, PLATFORM_FEE_RATE } from './content'
import { SectionHead } from './SectionHead'

type Side = keyof typeof AUDIENCES
const SIDES: Side[] = ['creator', 'editor']

const MIN = 50
const MAX = 3000
const STEP = 10

/**
 * Calculadora com as regras reais (padrão do simulador do site de energia
 * solar do acervo, mas sem estimativa: taxa e prazo são os do backend).
 */
function Calculator({ side }: { side: Side }) {
  const [value, setValue] = useState(480)
  const fee = Math.round(value * PLATFORM_FEE_RATE * 100) / 100
  const fill = `${((value - MIN) / (MAX - MIN)) * 100}%`
  const inputId = useId()

  const rows =
    side === 'editor'
      ? [
          { label: 'Valor combinado do pedido', value: formatMoney(value) },
          { label: `Taxa CutMakers (${PLATFORM_FEE_RATE * 100}%)`, value: `− ${formatMoney(fee)}` },
        ]
      : [
          { label: 'Valor combinado com o editor', value: formatMoney(value) },
          { label: 'Taxa para o criador', value: formatMoney(0) },
        ]

  const total = side === 'editor' ? value - fee : value

  return (
    <div className="rounded-2xl border border-border bg-background p-6 sm:p-8">
      <label htmlFor={inputId} className="text-sm font-semibold text-foreground">
        {side === 'editor' ? 'Quanto você recebe' : 'Quanto você paga'}
      </label>
      <input
        id={inputId}
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="lp-range mt-5"
        style={{ ['--fill' as string]: fill }}
        aria-valuetext={formatMoney(value)}
      />
      <dl className="mt-6 space-y-3 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{r.value}</dd>
          </div>
        ))}
        <div className="flex items-end justify-between gap-4 border-t border-border pt-4">
          <dt className="font-semibold text-foreground">{side === 'editor' ? 'Você recebe' : 'Total'}</dt>
          <dd className="font-heading text-3xl font-extrabold tabular-nums tracking-tight text-brand" aria-live="polite">
            {formatMoney(total)}
          </dd>
        </div>
      </dl>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        {side === 'editor'
          ? `Liberado quando o criador aprova a entrega, ou automaticamente após ${AUTO_APPROVE_DAYS} dias sem resposta.`
          : 'Fica retido na plataforma e só vai para o editor quando você aprova a entrega.'}
      </p>
    </div>
  )
}

export function Audiences({ onRegister }: { onRegister: () => void }) {
  const [side, setSide] = useState<Side>('creator')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const baseId = useId()
  const content = AUDIENCES[side]

  // "Sou editor" (hero, barra do celular) e "Para editores" (menu) apontam para
  // esta seção: chegar por eles já abre a aba do editor.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('a[href="#para-editores"]')) setSide('editor')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // Abas acessíveis: setas trocam e movem o foco (padrão WAI-ARIA, como no site da veterinária)
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = SIDES[(SIDES.indexOf(side) + 1) % SIDES.length]
    setSide(next)
    tabRefs.current[SIDES.indexOf(next)]?.focus()
  }

  return (
    <section id="para-editores" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <SectionHead eyebrow="Para os dois lados" title={<>Quem grava e quem edita jogam no mesmo time.</>} />

      <div
        role="tablist"
        aria-label="Escolha seu perfil"
        className="mb-8 inline-flex rounded-full border border-border bg-card p-1"
        onKeyDown={onKey}
      >
        {SIDES.map((s, i) => (
          <button
            key={s}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${s}`}
            aria-selected={side === s}
            aria-controls={`${baseId}-panel`}
            tabIndex={side === s ? 0 : -1}
            onClick={() => setSide(s)}
            className={`h-10 rounded-full px-5 font-heading text-sm font-semibold transition-colors ${
              side === s ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {AUDIENCES[s].tab}
          </button>
        ))}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${side}`}
        className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr]"
      >
        <div key={side} className="anim-fade-up">
          <h3 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground">
            {content.title}
          </h3>
          <ul className="mt-6 space-y-3.5">
            {content.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] leading-relaxed text-muted-foreground">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                  <IconCheck size={13} stroke={2.6} className="text-brand" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onRegister}
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-brand px-6 font-heading text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            {content.cta} <IconArrowRight size={17} stroke={2.2} />
          </button>
        </div>

        <Calculator side={side} />
      </div>
    </section>
  )
}
