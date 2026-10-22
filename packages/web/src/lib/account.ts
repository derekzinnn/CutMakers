import { api } from './api'
import type { AuthUser } from '@/hooks/use-auth'

export interface UpdateMePayload {
  name?: string
  bio?: string | null
  avatarUrl?: string | null
}

/** Edita nome, bio e avatar da conta. Devolve o usuário atualizado. */
export async function updateMe(payload: UpdateMePayload): Promise<AuthUser> {
  const { data } = await api.patch<{ user: AuthUser }>('/auth/me', payload)
  return data.user
}

/** Troca a senha (exige a atual). */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.patch('/auth/password', { currentPassword, newPassword })
}
