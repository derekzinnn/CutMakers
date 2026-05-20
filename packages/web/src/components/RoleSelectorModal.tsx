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
        style={{ background: '#162436', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h2 className="mb-1 text-center font-heading text-xl font-bold text-white">
          Olá, {user.name}!
        </h2>
        <p className="mb-8 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Como você deseja acessar a plataforma hoje?
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onSelectCreator}
            className="group flex flex-col items-center gap-3 rounded-card p-6 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(244,99,30,0.08)'
              e.currentTarget.style.borderColor = 'rgba(244,99,30,0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            }}
          >
            <IconCamera size={32} stroke={1.5} color="#F4631E" />
            <span className="font-heading font-semibold text-white">Criador</span>
            <span className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Contratar editores e gerenciar projetos
            </span>
          </button>

          <button
            onClick={onSelectEditor}
            className="group flex flex-col items-center gap-3 rounded-card p-6 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(244,99,30,0.08)'
              e.currentTarget.style.borderColor = 'rgba(244,99,30,0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            }}
          >
            <IconMovie size={32} stroke={1.5} color="#F4631E" />
            <span className="font-heading font-semibold text-white">Editor</span>
            <span className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Receber pedidos e gerenciar portfólio
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
