import { useEffect, useRef } from 'react'

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Chama `onFrame` no máximo uma vez por quadro enquanto a página rola (e no resize).
 *
 * Os efeitos da landing escrevem variáveis CSS direto no elemento em vez de
 * guardar a posição em estado: um setState por quadro re-renderizaria a seção
 * inteira 60 vezes por segundo.
 */
export function useScrollFrame(onFrame: () => void) {
  const cb = useRef(onFrame)
  cb.current = onFrame

  useEffect(() => {
    let raf = 0
    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        cb.current()
      })
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])
}
