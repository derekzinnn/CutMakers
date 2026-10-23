import { useCallback, useState } from 'react'

/**
 * useState que sobrevive a sair e voltar da tela (ex.: abrir o perfil de um editor e clicar
 * na seta). Guarda em sessionStorage — vale só para a aba e some ao fechá-la, então não
 * vaza filtro de uma sessão para outra. Valores precisam ser serializáveis em JSON.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const storageKey = `cm_state:${key}`
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(resolved))
        } catch {
          /* storage cheio/bloqueado: segue só em memória */
        }
        return resolved
      })
    },
    [storageKey],
  )

  return [value, set] as const
}
