import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { IconArrowRight, IconCheck } from '@tabler/icons-react'
import { AUDIENCES } from './content'
import { SectionHead } from './SectionHead'

type Side = keyof typeof AUDIENCES
const SIDES: Side[] = ['creator', 'editor']

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
        key={side}
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${side}`}
        className="anim-fade-up grid items-start gap-8 rounded-2xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12"
      >
        <div>
          <h3 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-[1.1] tracking-[-0.03em] text-foreground">
            {content.title}
          </h3>
          <button
            type="button"
            onClick={onRegister}
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-brand px-6 font-heading text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand-hover"
          >
            {content.cta} <IconArrowRight size={17} stroke={2.2} />
          </button>
        </div>

        <ul className="space-y-4">
          {content.points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[15px] leading-relaxed text-muted-foreground">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                <IconCheck size={13} stroke={2.6} className="text-brand" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
