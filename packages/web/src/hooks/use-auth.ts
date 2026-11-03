import { useState } from 'react'

export type UserRole = 'CREATOR' | 'EDITOR' | 'BOTH' | 'ADMIN'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string | null
  bio?: string | null
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('user')
    return stored ? (JSON.parse(stored) as AuthUser) : null
  })

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  function login(newToken: string, newRefreshToken: string, newUser: AuthUser) {
    localStorage.setItem('token', newToken)
    localStorage.setItem('refreshToken', newRefreshToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  // Troca de senha emite um par de tokens novo (a versão antiga para de valer no
  // próximo refresh — ver auth.controller.ts). Sem isto a pessoa que acabou de trocar
  // a própria senha seria deslogada na expiração do access token em até 15min.
  function refreshTokens(newToken: string, newRefreshToken: string) {
    localStorage.setItem('token', newToken)
    localStorage.setItem('refreshToken', newRefreshToken)
    setToken(newToken)
  }

  // Reflete edicoes de perfil (nome/avatar/bio) sem precisar relogar
  function updateUser(patch: Partial<AuthUser>) {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem('user', JSON.stringify(next))
      return next
    })
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return { user, token, login, logout, updateUser, refreshTokens, isAuthenticated: !!token }
}
