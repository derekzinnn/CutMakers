import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconArrowRight, IconPlus } from '@tabler/icons-react'
import { CMLockup } from '@/components/ui/CMLogo'
import { FAQ, NAV } from './content'
import { useScrollFrame } from './motion'
import { SectionHead } from './SectionHead'

export function Faq() {
  return (
    <section id="duvidas" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="grid items-start gap-2 lg:grid-cols-[1fr_1.4fr] lg:gap-10">
        <div className="lg:sticky lg:top-24">
          <SectionHead eyebrow="Dúvidas" title={<>O que todo mundo pergunta antes do primeiro pedido.</>} />
        </div>
        <div className="divide-y divide-border border-y border-border">
          {FAQ.map((f) => (
            <details key={f.q} className="lp-faq group">
              <summary className="flex items-center justify-between gap-6 py-5 font-heading text-[17px] font-bold text-foreground">
                {f.q}
                <IconPlus size={18} className="lp-faq-icon shrink-0 text-brand" aria-hidden="true" />
              </summary>
              <p className="-mt-1 pb-5 pr-10 text-[15px] leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FinalCta({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-brand px-6 py-14 text-center sm:px-12 sm:py-20">
        <h2 className="mx-auto max-w-3xl text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.035em] text-brand-foreground">
          Seu próximo vídeo já tem editor. Só falta você chamar.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-brand-foreground">
          Criar conta é grátis para criador e para editor.
        </p>
        <button
          type="button"
          onClick={onRegister}
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-background px-7 font-heading text-[15px] font-semibold text-foreground transition-colors hover:bg-card"
        >
          Criar conta grátis <IconArrowRight size={17} stroke={2.2} />
        </button>
      </div>
    </section>
  )
}

/*
 * Medidor de rolagem (anim-medidor-rolagem-metros do acervo) com a régua do
 * nicho: película 35 mm. 1 px CSS = 0,2646 mm; a 24 quadros por segundo, com
 * quadro de 19 mm (4 perfurações), o filme corre 456 mm por segundo.
 */
const MM_PER_PX = 0.2646
const FILM_MM_PER_SECOND = 456

function ScrollMeter() {
  const textRef = useRef<HTMLSpanElement>(null)
  const state = useRef({ last: 0, total: 0 })

  useEffect(() => {
    state.current.last = window.scrollY
  }, [])

  useScrollFrame(() => {
    const s = state.current
    s.total += Math.abs(window.scrollY - s.last)
    s.last = window.scrollY
    const mm = s.total * MM_PER_PX
    const seconds = mm / FILM_MM_PER_SECOND
    if (textRef.current) {
      textRef.current.textContent = `Você rolou ${(mm / 1000).toLocaleString('pt-BR', {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      })} m de página. Em película 35 mm, dá ${Math.round(seconds)} s de filme.`
    }
  })

  return <span ref={textRef}>Você rolou 0,0 m de página.</span>
}

export function Footer() {
  const navigate = useNavigate()
  return (
    <footer className="border-t border-border pb-28 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <CMLockup size={32} wordSize={20} variant="orange" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Marketplace de edição de vídeo. Conecta criadores de conteúdo a editores freelancers.
          </p>
        </div>
        <nav aria-label="Rodapé">
          <p className="mb-4 font-heading text-sm font-bold text-foreground">Navegação</p>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {NAV.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`} className="transition-colors hover:text-foreground">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="mb-4 font-heading text-sm font-bold text-foreground">Legal</p>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li>
              <button type="button" onClick={() => navigate('/termos')} className="transition-colors hover:text-foreground">
                Termos de uso
              </button>
            </li>
            <li>
              <button type="button" onClick={() => navigate('/privacidade')} className="transition-colors hover:text-foreground">
                Privacidade
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-border px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <span>© 2026 CutMakers</span>
        <span aria-hidden="true" className="tabular-nums">
          <ScrollMeter />
        </span>
      </div>
    </footer>
  )
}

/** Barra fixa no celular (padrão do site-revenda-seminovos-estoque): aparece depois do hero. */
export function MobileBar({ onRegister }: { onRegister: () => void }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('topo')
    if (!hero) return
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0 })
    io.observe(hero)
    return () => io.disconnect()
  }, [])

  return (
    <div
      className="lp-mobilebar fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card px-4 pt-3 md:hidden"
      data-show={show}
      aria-hidden={!show}
    >
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRegister}
          tabIndex={show ? 0 : -1}
          className="h-11 flex-1 rounded-md bg-brand font-heading text-sm font-semibold text-brand-foreground"
        >
          Encontrar editor
        </button>
        <a
          href="#para-editores"
          tabIndex={show ? 0 : -1}
          className="flex h-11 flex-1 items-center justify-center rounded-md border border-border bg-surface-raised font-heading text-sm font-semibold text-foreground"
        >
          Sou editor
        </a>
      </div>
    </div>
  )
}
