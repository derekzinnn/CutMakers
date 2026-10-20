import { IconEye, IconLogout } from '@tabler/icons-react'
import { impersonatedUser, isImpersonating, restoreAdminSession } from '@/lib/impersonation'

/**
 * Barra fixa durante a sessão de visualização.
 *
 * Deliberadamente impossível de ignorar: o admin está vendo a tela exatamente
 * como o usuário vê, então sem este aviso ele pode confundir os dados de outra
 * pessoa com os próprios — ou achar que uma ação falhou, quando na verdade a
 * sessão é somente leitura.
 */
export function ImpersonationBanner() {
  if (!isImpersonating()) return null
  const alvo = impersonatedUser()
  if (!alvo) return null

  function sair() {
    restoreAdminSession()
    window.location.href = '/admin'
  }

  return (
    <div
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
      style={{
        background: 'var(--warning-soft)',
        borderBottom: '1px solid var(--warning-border)',
        color: 'var(--foreground)',
      }}
    >
      <IconEye size={16} stroke={1.8} style={{ color: 'var(--warning)' }} />
      <span>
        Vendo como <strong className="text-white">{alvo.name}</strong>
        <span style={{ color: 'var(--muted-foreground)' }}> · {alvo.email}</span>
      </span>
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
        style={{ background: 'var(--warning-border)', color: 'var(--warning)' }}
      >
        somente leitura
      </span>
      <button
        onClick={sair}
        className="ml-1 inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all"
        style={{ background: 'var(--warning)', color: 'var(--background)', border: 'none', cursor: 'pointer' }}
      >
        <IconLogout size={13} stroke={2} />
        Voltar ao admin
      </button>
    </div>
  )
}
