/**
 * Formatação compartilhada — antes espalhada e INCONSISTENTE pelo app.
 *
 * Dinheiro tinha 5 variantes: `toFixed(2)` cru ("R$ 1234.56"), `.replace('.',',')`
 * ("R$ 1234,56") e `toLocaleString('pt-BR')` ("R$ 1.234,56"). O mesmo valor
 * aparecia diferente dependendo da tela. Agora é uma só, no padrão brasileiro.
 */
export function formatMoney(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Data relativa curta (chat, sino de notificações): "agora", "5min", "3h", "2d".
 * Era copiada byte a byte em MessagesTab e DashboardShell.
 */
export function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

/**
 * Data relativa longa (avaliações, histórico): "hoje", "há 3 dias", "há 2 meses".
 * Forma distinta da curta de propósito — uma avaliação "5min" ficaria estranho.
 */
export function relativeDateLong(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'há 1 dia'
  if (days < 7) return `há ${days} dias`
  const weeks = Math.floor(days / 7)
  if (weeks === 1) return 'há 1 semana'
  if (weeks < 5) return `há ${weeks} semanas`
  const months = Math.floor(days / 30)
  if (months === 1) return 'há 1 mês'
  return `há ${months} meses`
}
