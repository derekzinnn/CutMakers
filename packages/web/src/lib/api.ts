import axios from 'axios'
import { restoreAdminSession } from './impersonation'

export const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    // Sessao de visualizacao ("ver como"): dura 15min e NAO tem refresh token.
    // Ao expirar, devolve o admin para a propria conta em vez de deixa-lo vendo
    // erros sem explicacao — ou pior, cair no localStorage.clear() abaixo, que
    // apagaria o backup da sessao dele e exigiria login de novo.
    if (error.response?.status === 401 && localStorage.getItem('impersonating')) {
      restoreAdminSession()
      window.location.href = '/admin?sessao=expirada'
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken })
          localStorage.setItem('token', data.token)
          localStorage.setItem('refreshToken', data.refreshToken)
          original.headers.Authorization = `Bearer ${data.token}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  },
)
