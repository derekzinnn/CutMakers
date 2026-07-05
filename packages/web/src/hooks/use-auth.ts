import { useState } from 'react'

export type UserRole = 'CREATOR' | 'EDITOR' | 'BOTH' | 'ADMIN'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string | null
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

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  return { user, token, login, logout, isAuthenticated: !!token }
}
