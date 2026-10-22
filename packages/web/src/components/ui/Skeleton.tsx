/**
 * Skeletons — substituem a rodinha girando.
 *
 * A diferença não é estética: o skeleton tem a FORMA do conteúdo que vem, então
 * a página não salta quando os dados chegam e a pessoa já entende o que está
 * carregando. Um spinner centralizado não informa nada e faz a tela piscar.
 *
 * Use sempre o skeleton da forma certa (tabela, card, stat). Um retângulo
 * genérico no lugar de uma tabela é quase tão ruim quanto o spinner.
 */
import type { CSSProperties } from 'react'

export function Skeleton({
  className = '',
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`skeleton-shimmer rounded-md ${className}`}
      style={{ background: 'var(--surface-subtle)', ...style }}
      aria-hidden="true"
    />
  )
}

/** Linhas de tabela. `cols` deve bater com o grid da tabela real. */
export function SkeletonTable({
  rows = 6,
  cols = 5,
  gridClass,
}: {
  rows?: number
  cols?: number
  gridClass?: string
}) {
  return (
    <div className="space-y-1" role="status" aria-label="Carregando lista">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={gridClass ?? `grid gap-4 px-4 py-3`}
          style={gridClass ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className="h-4"
              // Larguras irregulares: barras idênticas parecem um componente
              // quebrado, não conteúdo chegando
              style={{ width: `${55 + ((i * 7 + j * 13) % 40)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Cards de estatística do topo dos dashboards. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Carregando resumo">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-card p-5"
          style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

/** Grade de cards (editores, portfólio, oportunidades). */
export function SkeletonCards({ count = 6, withMedia = true }: { count?: number; withMedia?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Carregando itens">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-card"
          style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
        >
          {withMedia && <Skeleton className="h-40 w-full rounded-none" />}
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Lista simples (notificações, conversas, histórico). */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-[8px] p-3"
          style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}
        >
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5" style={{ width: `${50 + ((i * 11) % 35)}%` }} />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
