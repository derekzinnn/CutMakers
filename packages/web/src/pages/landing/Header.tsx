import { useRef } from 'react'
import { CMLockup } from '@/components/ui/CMLogo'
import { NAV } from './content'
import { clamp01, useScrollFrame } from './motion'

export function Header({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const headerRef = useRef<HTMLElement>(null)

  useScrollFrame(() => {
    const el = headerRef.current
    if (!el) return
    const max = document.documentElement.scrollHeight - window.innerHeight
    el.dataset.solid = String(window.scrollY > 8)
    el.style.setProperty('--p', String(max > 0 ? clamp01(window.scrollY / max) : 0))
  })

  return (
    <header ref={headerRef} className="lp-header sticky top-0 z-30" data-solid="false">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <a href="#topo" aria-label="CutMakers, voltar ao topo" className="shrink-0">
          <CMLockup size={32} wordSize={20} variant="orange" />
        </a>

        <nav aria-label="Seções" className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onLogin}
            className="h-10 rounded-md px-3 font-heading text-sm font-semibold text-foreground transition-colors hover:bg-surface-raised sm:px-4"
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={onRegister}
            className="h-10 rounded-md bg-brand px-3 font-heading text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover sm:px-4"
          >
            Criar conta
          </button>
        </div>
      </div>
      <div className="lp-progress" aria-hidden="true" />
    </header>
  )
}
