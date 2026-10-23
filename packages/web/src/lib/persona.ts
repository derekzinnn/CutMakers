import { api } from './api'
import { limparCache } from './cache'
import type { AuthUser } from '@/hooks/use-auth'

/**
 * Personas do admin: criador e editor DISTINTOS, donos da mesma conta admin.
 *
 * Entrar numa persona troca a sessão do navegador pela dela (token + usuário) e guarda a
 * sessão do admin em `cm_admin_session`. Voltar restaura a do admin. Logout limpa o
 * localStorage inteiro, então a sessão guardada some junto — nada sobra para o próximo login.
 */

const BACKUP_KEY = 'cm_admin_session'

interface Session {
  token: string
  refreshToken: string
  user: string
}

export function inPersona(): boolean {
  try {
    return localStorage.getItem(BACKUP_KEY) !== null
  } catch {
    return false
  }
}

export async function enterPersona(kind: 'CREATOR' | 'EDITOR'): Promise<void> {
  const { data } = await api.post<{ token: string; refreshToken: string; user: AuthUser }>('/admin/personas', { kind })

  // Só guarda a sessão do admin na PRIMEIRA troca; ir de criador para editor não a sobrescreve
  if (!inPersona()) {
    const backup: Session = {
      token: localStorage.getItem('token') ?? '',
      refreshToken: localStorage.getItem('refreshToken') ?? '',
      user: localStorage.getItem('user') ?? '',
    }
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup))
  }

  localStorage.setItem('token', data.token)
  localStorage.setItem('refreshToken', data.refreshToken)
  localStorage.setItem('user', JSON.stringify(data.user))
  // Dados em cache e filtros guardados são da identidade anterior
  limparCache()
  // Recarga completa: todo hook que leu o usuário/token na montagem precisa ler de novo
  window.location.assign(kind === 'CREATOR' ? '/dashboard/creator' : '/dashboard/editor')
}

export function exitPersona(): void {
  const raw = localStorage.getItem(BACKUP_KEY)
  if (!raw) {
    window.location.assign('/admin')
    return
  }
  const s = JSON.parse(raw) as Session
  localStorage.setItem('token', s.token)
  localStorage.setItem('refreshToken', s.refreshToken)
  localStorage.setItem('user', s.user)
  localStorage.removeItem(BACKUP_KEY)
  limparCache()
  window.location.assign('/admin')
}
