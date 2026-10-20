import { IconMovie, IconCamera } from '@tabler/icons-react'
import type { AuthUser } from '@/hooks/use-auth'

interface Props {
  user: AuthUser
  onSelectCreator: () => void
  onSelectEditor: () => void
}

export function RoleSelectorModal({ user, onSelectCreator, onSelectEditor }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-modal p-8"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <h2 className="mb-1 text-center font-heading text-xl font-bold text-white">
          Olá, {user.name}!
        </h2>
        <p className="mb-8 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Como você deseja acessar a plataforma hoje?
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onSelectCreator}
            className="group flex flex-col items-center gap-3 rounded-card p-6 transition-colors"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--brand-soft)'
              e.currentTarget.style.borderColor = 'var(--brand-border)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-subtle)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <IconCamera size={32} stroke={1.5} color="var(--brand)" />
            <span className="font-heading font-semibold text-white">Criador</span>
            <span className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Contratar editores e gerenciar projetos
            </span>
          </button>

          <button
            onClick={onSelectEditor}
            className="group flex flex-col items-center gap-3 rounded-card p-6 transition-colors"
            style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--brand-soft)'
              e.currentTarget.style.borderColor = 'var(--brand-border)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface-subtle)'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <IconMovie size={32} stroke={1.5} color="var(--brand)" />
            <span className="font-heading font-semibold text-white">Editor</span>
            <span className="text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Receber pedidos e gerenciar portfólio
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
