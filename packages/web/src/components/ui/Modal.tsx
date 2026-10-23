import { useEffect, useId, useRef } from 'react'
import { IconX } from '@tabler/icons-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: Props) {
  const titleId = useId()
  const subtitleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  // onClose costuma chegar como arrow inline (muda a cada render) — por ref, o efeito de
  // foco não reinicia a cada digitação e não "rouba" o foco do campo.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Foco: entra ao abrir, fica preso no diálogo e volta ao gatilho ao fechar (WCAG 2.4.3).
  // Esc fecha. O primeiro foco cai no 1º elemento focável (o "Fechar" do cabeçalho), nunca
  // numa ação destrutiva do rodapé.
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))

    // `autoFocus` do React já pode ter posto o foco num campo — não atropela
    if (!dialog.contains(document.activeElement)) {
      const first = focusables()[0]
      if (first) first.focus()
      else dialog.focus()
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        dialog?.focus()
        return
      }
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === firstEl || !dialog?.contains(active))) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && (active === lastEl || !dialog?.contains(active))) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (trigger && document.contains(trigger)) trigger.focus()
    }
  }, [open])

  // Bloqueia scroll do body quando aberto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  const widths = { sm: 380, md: 520, lg: 720 }

  return (
    <div
      className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className="anim-scale-in w-full overflow-hidden rounded-modal"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          maxWidth: widths[size],
          // dvh: no celular, 100dvh é a altura SEM a barra do navegador e o diálogo estoura
          maxHeight: 'calc(100dvh - 4rem)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 id={titleId} className="font-heading text-lg font-bold text-white">{title}</h2>
            {subtitle && (
              <p id={subtitleId} className="mt-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors"
            style={{
              color: 'var(--muted-foreground)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-subtle)'
              e.currentTarget.style.color = 'var(--foreground)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.color = 'var(--muted-foreground)'
            }}
          >
            <IconX size={18} stroke={1.5} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-6 py-4"
            style={{ borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
