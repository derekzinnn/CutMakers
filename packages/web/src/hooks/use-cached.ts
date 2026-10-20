import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TTL_PADRAO,
  buscarDesduplicado,
  inscrever,
  invalidar,
  lerCache,
} from '@/lib/cache'

interface Opcoes {
  /** Quanto tempo o dado é considerado fresco (ms). */
  ttl?: number
  /** Pula a busca — para dependências que ainda não chegaram. */
  habilitado?: boolean
}

interface Resultado<T> {
  dado: T | null
  /** true apenas na PRIMEIRA carga sem cache — é o que decide mostrar skeleton. */
  carregando: boolean
  /** true quando há dado em tela e uma revalidação acontece atrás. */
  revalidando: boolean
  erro: string | null
  recarregar: () => Promise<void>
}

/**
 * Busca com cache, desduplicação e stale-while-revalidate.
 *
 * `carregando` é false quando há dado em cache, mesmo velho: a tela mostra o
 * conteúdo anterior e atualiza sozinha. É o que elimina o pisca-pisca de
 * spinner a cada navegação.
 */
export function useCached<T>(
  chave: string | null,
  buscar: () => Promise<T>,
  { ttl = TTL_PADRAO, habilitado = true }: Opcoes = {},
): Resultado<T> {
  const emCache = chave ? lerCache<T>(chave, ttl) : null

  const [dado, setDado] = useState<T | null>(emCache?.dado ?? null)
  const [carregando, setCarregando] = useState(!emCache && habilitado && !!chave)
  const [revalidando, setRevalidando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Em ref para nao reexecutar o efeito quando o chamador passa uma funcao nova
  // a cada render — o que sem isto viraria loop infinito de fetch.
  const buscarRef = useRef(buscar)
  buscarRef.current = buscar

  const executar = useCallback(
    async (silencioso: boolean) => {
      if (!chave) return
      if (silencioso) setRevalidando(true)
      else setCarregando(true)
      setErro(null)
      try {
        const r = await buscarDesduplicado(chave, () => buscarRef.current())
        setDado(r)
      } catch (e) {
        const err = e as { response?: { data?: { message?: string } } }
        setErro(err?.response?.data?.message ?? 'Não foi possível carregar os dados')
      } finally {
        setCarregando(false)
        setRevalidando(false)
      }
    },
    [chave],
  )

  useEffect(() => {
    if (!chave || !habilitado) return
    const atual = lerCache<T>(chave, ttl)

    if (atual) {
      setDado(atual.dado)
      setCarregando(false)
      // Velho: mostra o que tem e revalida atrás, sem piscar
      if (!atual.fresco) void executar(true)
    } else {
      void executar(false)
    }

    // Outro componente gravou nesta chave (ou ela foi invalidada): acompanha
    return inscrever(chave, () => {
      const novo = lerCache<T>(chave, ttl)
      if (novo) setDado(novo.dado)
      else void executar(true)
    })
  }, [chave, habilitado, ttl, executar])

  const recarregar = useCallback(async () => {
    if (!chave) return
    invalidar(chave)
    await executar(true)
  }, [chave, executar])

  return { dado, carregando, revalidando, erro, recarregar }
}
