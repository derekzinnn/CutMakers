import { useEffect } from 'react'
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

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: Props) {
  // Fecha com Esc
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full overflow-hidden rounded-modal"
        style={{
          background: '#162436',
          border: '1px solid rgba(255,255,255,0.08)',
          maxWidth: widths[size],
          maxHeight: 'calc(100vh - 4rem)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div>
            <h2 className="font-heading text-lg font-bold text-white">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
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
              color: 'rgba(255,255,255,0.4)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none'
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
            }}
          >
            <IconX size={18} stroke={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className="flex items-center justify-end gap-2 px-6 py-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
