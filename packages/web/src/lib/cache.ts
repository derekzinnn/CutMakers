/**
 * Cache de dados com stale-while-revalidate.
 *
 * Três problemas que isto resolve, e que davam para ver na aba de rede:
 *
 * 1. Toda navegação refazia a busca do zero, com spinner, mesmo voltando para
 *    uma tela vista há dois segundos.
 * 2. Requests DUPLICADOS simultâneos: dois componentes montando ao mesmo tempo
 *    pediam `/editors/me` duas vezes. A desduplicação por chave resolve.
 * 3. `use-categories` tinha um cache caseiro PERMANENTE — nunca invalidava, então
 *    uma categoria criada no portfólio não aparecia até dar F5.
 *
 * Stale-while-revalidate: havendo dado em cache, ele volta NA HORA (sem spinner)
 * e a revalidação acontece atrás. A tela nunca pisca para quem volta.
 */

interface Entrada<T> {
  dado: T
  gravadoEm: number
}

const cache = new Map<string, Entrada<unknown>>()
/** Requests em voo, por chave — é o que impede a chamada duplicada. */
const emVoo = new Map<string, Promise<unknown>>()
/** Quem quer saber que uma chave mudou (os hooks se inscrevem). */
const inscritos = new Map<string, Set<() => void>>()

/** Padrão: 30s. Tempo suficiente para navegar e voltar sem refetch. */
export const TTL_PADRAO = 30_000
/** Dados que quase não mudam (categorias). */
export const TTL_LONGO = 5 * 60_000

export function lerCache<T>(chave: string, ttl = TTL_PADRAO): { dado: T; fresco: boolean } | null {
  const e = cache.get(chave) as Entrada<T> | undefined
  if (!e) return null
  return { dado: e.dado, fresco: Date.now() - e.gravadoEm < ttl }
}

export function gravarCache<T>(chave: string, dado: T) {
  cache.set(chave, { dado, gravadoEm: Date.now() })
  inscritos.get(chave)?.forEach((fn) => fn())
}

export function inscrever(chave: string, fn: () => void) {
  if (!inscritos.has(chave)) inscritos.set(chave, new Set())
  inscritos.get(chave)!.add(fn)
  return () => {
    inscritos.get(chave)?.delete(fn)
  }
}

/**
 * Busca desduplicada: chamadas simultâneas para a mesma chave compartilham
 * uma única request.
 */
export function buscarDesduplicado<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
  const jaEmVoo = emVoo.get(chave) as Promise<T> | undefined
  if (jaEmVoo) return jaEmVoo

  const p = buscar()
    .then((dado) => {
      gravarCache(chave, dado)
      return dado
    })
    .finally(() => {
      emVoo.delete(chave)
    })

  emVoo.set(chave, p)
  return p
}

/**
 * Invalida por prefixo. Chamar DEPOIS de qualquer mutação — sem isto o cache
 * entrega dado velho e o usuário acha que a ação dele não funcionou, que é bem
 * pior do que esperar um spinner.
 *
 * Ex.: `invalidar('orders')` derruba 'orders', 'orders:editor', 'orders:creator:2'...
 */
export function invalidar(prefixo: string) {
  for (const chave of [...cache.keys()]) {
    if (chave === prefixo || chave.startsWith(prefixo + ':')) {
      cache.delete(chave)
      inscritos.get(chave)?.forEach((fn) => fn())
    }
  }
}

/** Logout: zera tudo. Dado de um usuário não pode vazar para a sessão do próximo. */
export function limparCache() {
  cache.clear()
  emVoo.clear()
}
