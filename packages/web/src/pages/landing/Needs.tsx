import { IconArrowRight } from '@tabler/icons-react'
import { FORMATS_TICKER, NEEDS } from './content'
import { SectionHead } from './SectionHead'

/** Faixa infinita: duas cópias lado a lado e translateX(-50%), o salto fica invisível. */
export function FormatsTicker() {
  const row = (copy: number) => (
    <ul className="flex shrink-0 items-center" aria-hidden={copy === 1 || undefined}>
      {FORMATS_TICKER.map((f) => (
        <li key={f} className="flex items-center whitespace-nowrap px-6 font-heading text-lg font-bold tracking-tight text-muted-foreground sm:text-xl">
          {f}
          <span className="ml-12 h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
        </li>
      ))}
    </ul>
  )

  return (
    <div className="border-y border-border bg-card py-5">
      <p className="sr-only">Formatos atendidos: {FORMATS_TICKER.join(', ')}.</p>
      <div className="lp-ticker" aria-hidden="true">
        <div className="lp-ticker-track">
          {row(0)}
          {row(1)}
        </div>
      </div>
    </div>
  )
}

/**
 * Navegação por necessidade (padrão do site-clinica-ortopedia do acervo): o
 * criador reconhece o próprio problema antes de saber o nome da categoria.
 */
export function Needs({ onRegister }: { onRegister: () => void }) {
  return (
    <section id="formatos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <SectionHead eyebrow="Formatos" title={<>O que você precisa cortar?</>}>
        Comece pelo problema. A gente mostra quem resolve.
      </SectionHead>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NEEDS.map((n) => (
          <button
            key={n.need}
            type="button"
            onClick={onRegister}
            className="lp-need flex min-h-[188px] flex-col justify-between rounded-xl border border-border bg-card p-6 text-left"
          >
            <span className="font-heading text-[17px] font-bold leading-snug tracking-[-0.01em] text-foreground">
              “{n.need}”
            </span>
            <span className="mt-6 flex items-end justify-between gap-4">
              <span>
                <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-brand">{n.category}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{n.detail}</span>
              </span>
              <IconArrowRight size={18} className="lp-need-arrow shrink-0 text-brand" aria-hidden="true" />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
