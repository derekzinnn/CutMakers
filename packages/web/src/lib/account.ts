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
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ token: string; refreshToken: string }> {
  // A troca invalida a sessão (tokenVersion sobe no backend) e devolve um par de
  // tokens novo já na versão atual, pra esta aba não ser deslogada também.
  const { data } = await api.patch<{ token: string; refreshToken: string }>('/auth/password', {
    currentPassword,
    newPassword,
  })
  return data
}

/** Login/cadastro com o ID token do Google. */
export async function loginWithGoogle(idToken: string): Promise<{ token: string; refreshToken: string; user: AuthUser }> {
  const { data } = await api.post<{ token: string; refreshToken: string; user: AuthUser }>('/auth/google', { idToken })
  return data
}
