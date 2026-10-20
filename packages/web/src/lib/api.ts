import axios from 'axios'
import { invalidar, limparCache } from './cache'

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

/**
 * Que chaves de cache cada escrita derruba.
 *
 * Fica AQUI, e nao espalhado nos 24 pontos de mutacao, porque esquecer um
 * significa a tela mostrar dado velho depois da acao do usuario — ele conclui
 * que nao funcionou e repete. Isso e pior que esperar um spinner.
 *
 * Chat (`/conversations`) de proposito nao invalida nada: tem polling proprio e
 * manda mensagem a cada poucos segundos, entao derrubaria o cache o tempo todo.
 */
const INVALIDACOES: [RegExp, string[]][] = [
  [/^\/orders/, ['orders', 'editor-me', 'payments']],
  [/^\/portfolio/, ['editor-me', 'categories']],
  [/^\/requests/, ['requests', 'orders']],
  [/^\/subscriptions/, ['subscription', 'editor-me']],
  [/^\/editors\/me/, ['editor-me', 'editors']],
  [/^\/admin\/users/, ['admin-users']],
  [/^\/notifications/, ['notifications']],
]

api.interceptors.response.use(
  (res) => {
    // Qualquer escrita bem-sucedida derruba o cache relacionado
    const metodo = (res.config.method ?? 'get').toUpperCase()
    if (metodo !== 'GET') {
      const url = res.config.url ?? ''
      for (const [padrao, chaves] of INVALIDACOES) {
        if (padrao.test(url)) chaves.forEach(invalidar)
      }
    }
    return res
  },
  async (error) => {
    const original = error.config

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
          limparCache()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  },
)
