import axios from 'axios'
import { api } from './api'

/**
 * Sessão de visualização administrativa ("ver como").
 *
 * O token do admin é guardado em chaves de backup e o token de impersonação
 * assume o lugar do token ativo. Sair restaura o admin. Guardar em vez de
 * descartar evita que o admin tenha que logar de novo ao voltar.
 */
const BACKUP_TOKEN = 'admin_token_backup'
const BACKUP_REFRESH = 'admin_refreshToken_backup'
const BACKUP_USER = 'admin_user_backup'
const ACTIVE = 'impersonating'

export interface ImpersonatedUser {
  id: string
  name: string
  email: string
  role: string
  banned: boolean
}

export function isImpersonating(): boolean {
  return localStorage.getItem(ACTIVE) !== null
}

export function impersonatedUser(): ImpersonatedUser | null {
  const raw = localStorage.getItem(ACTIVE)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ImpersonatedUser
  } catch {
    return null
  }
}

/** Inicia a sessão de visualização. O chamador decide para onde navegar. */
export async function startImpersonation(userId: string): Promise<ImpersonatedUser> {
  const { data } = await api.post<{ token: string; user: ImpersonatedUser }>(
    '/admin/impersonate',
    { userId },
  )

  // guarda a sessão do admin ANTES de trocar
  localStorage.setItem(BACKUP_TOKEN, localStorage.getItem('token') ?? '')
  localStorage.setItem(BACKUP_REFRESH, localStorage.getItem('refreshToken') ?? '')
  localStorage.setItem(BACKUP_USER, localStorage.getItem('user') ?? '')

  localStorage.setItem('token', data.token)
  // sem refresh token de propósito: a sessão expira em 15min e não se renova
  localStorage.removeItem('refreshToken')
  localStorage.setItem('user', JSON.stringify(data.user))
  localStorage.setItem(ACTIVE, JSON.stringify(data.user))

  return data.user
}

/**
 * Restaura a sessão do admin. Síncrono e à prova de falha de rede: o registro
 * no servidor é best-effort, mas voltar para a conta do admin nunca pode
 * depender de uma request dar certo — senão o admin fica preso na sessão.
 */
export function restoreAdminSession(): string | null {
  const alvo = impersonatedUser()
  const token = localStorage.getItem(BACKUP_TOKEN)
  const refresh = localStorage.getItem(BACKUP_REFRESH)
  const user = localStorage.getItem(BACKUP_USER)

  if (token) localStorage.setItem('token', token)
  if (refresh) localStorage.setItem('refreshToken', refresh)
  if (user) localStorage.setItem('user', user)

  localStorage.removeItem(BACKUP_TOKEN)
  localStorage.removeItem(BACKUP_REFRESH)
  localStorage.removeItem(BACKUP_USER)
  localStorage.removeItem(ACTIVE)

  // Registro na auditoria — falhar aqui não impede a volta.
  // axios cru de propósito: usar a instância `api` criaria ciclo de import,
  // já que api.ts precisa desta função no interceptor de 401.
  if (alvo && token) {
    void axios
      .post('/api/admin/impersonate/end', { userId: alvo.id }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .catch(() => {})
  }
  return alvo?.id ?? null
}
