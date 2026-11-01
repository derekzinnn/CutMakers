import { useRef, useState } from 'react'
import {
  IconBriefcase,
  IconCircleCheck,
  IconFileCertificate,
  IconLock,
  IconMessages,
  type Icon,
} from '@tabler/icons-react'
import { STEPS } from './content'
import { clamp01, useScrollFrame } from './motion'
import { SectionHead } from './SectionHead'

const ICONS: Icon[] = [IconBriefcase, IconFileCertificate, IconLock, IconMessages, IconCircleCheck]

/** Onde cada painel gruda: abaixo do cabeçalho e das abas, 12 px mais baixo que o anterior. */
const stickyTopOf = (i: number) => 132 + i * 12

/**
 * "Como funciona" em painéis empilhados (anim-paineis-empilhados-abas do acervo),
 * mas com position: sticky em vez de pin do GSAP: cada painel gruda um pouco
 * abaixo do anterior e o de baixo encolhe e escurece. As abas no topo enchem
 * conforme a rolagem passa por cada etapa.
 */
export function HowItWorks() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLSpanElement | null)[]>([])
  const panelRefs = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)
  const n = STEPS.length

  // Cada painel tem a própria "chegada" (0 quando entra pela base da tela, 1 quando
  // gruda no topo). A aba enche com a chegada do painel dela e o painel de baixo
  // escurece com a chegada do próximo, então abas e pilha nunca se desencontram.
  useScrollFrame(() => {
    const vh = window.innerHeight
    const arrival = panelRefs.current.map((el) => {
      if (!el) return 0
      const stickyTop = stickyTopOf(panelRefs.current.indexOf(el))
      return clamp01((vh - el.getBoundingClientRect().top) / (vh - stickyTop))
    })

    tabRefs.current.forEach((el, i) => el?.style.setProperty('--p', String(arrival[i])))
    panelRefs.current.forEach((el, i) => el?.style.setProperty('--d', String(arrival[i + 1] ?? 0)))

    let next = 0
    arrival.forEach((a, i) => {
      if (a >= 0.98) next = i
    })
    setActive((prev) => (prev === next ? prev : next))
  })

  return (
    <section id="como-funciona" className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <SectionHead eyebrow="Como funciona" title={<>Do bruto ao pagamento liberado, sem sair da plataforma.</>} />

        <div ref={wrapRef} className="relative">
          <ol className="sticky top-[68px] z-10 -mx-4 mb-6 grid grid-cols-5 gap-1.5 bg-card px-4 py-3 sm:mx-0 sm:px-0">
            {STEPS.map((s, i) => (
              <li key={s.tab} aria-current={active === i ? 'step' : undefined}>
                <span className="block h-1 overflow-hidden rounded-full bg-surface-raised">
                  <span
                    ref={(el) => {
                      tabRefs.current[i] = el
                    }}
                    className="lp-tab-fill block h-full bg-brand"
                  />
                </span>
                {/* No celular cinco rótulos não cabem: só a barra, e o nome da etapa ativa embaixo */}
                <span
                  className={`mt-2 hidden truncate text-xs font-semibold uppercase tracking-[0.08em] sm:block ${
                    active === i ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')} · {s.tab}
                </span>
              </li>
            ))}
            <li className="col-span-5 mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground sm:hidden" aria-hidden="true">
              {String(active + 1).padStart(2, '0')} · {STEPS[active].tab}
            </li>
          </ol>

          <div className="flex flex-col gap-6 pb-[8vh]">
            {STEPS.map((s, i) => {
              const Icon = ICONS[i]
              const alt = i % 2 === 1
              return (
                <article
                  key={s.tab}
                  ref={(el) => {
                    panelRefs.current[i] = el
                  }}
                  className={`lp-step grid min-h-[min(380px,56vh)] items-center gap-6 rounded-2xl border border-border p-6 sm:p-10 md:grid-cols-[1.2fr_1fr] md:gap-8 ${
                    alt ? 'bg-surface-raised' : 'bg-background'
                  }`}
                  style={{ top: stickyTopOf(i) }}
                >
                  <div>
                    <span className="font-mono text-xs tracking-[0.12em] text-muted-foreground">
                      {String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
                    </span>
                    <h3 className="mt-4 text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-foreground">
                      {s.title}
                    </h3>
                    <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">{s.text}</p>
                  </div>
                  <div className="flex flex-col items-start gap-5 md:items-center">
                    <div className="hidden h-20 w-20 items-center justify-center rounded-2xl bg-brand-soft md:flex">
                      <Icon size={38} stroke={1.6} className="text-brand" />
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground">
                      <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
                      {s.chip}
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
