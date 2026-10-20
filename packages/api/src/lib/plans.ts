/**
 * Limites por plano do editor — FONTE ÚNICA (backend e contrato da API).
 *
 * O Premium custa R$39,90/mês e até aqui entregava apenas o badge, o que é
 * pouco para justificar recorrência: não mudava nada do que o editor consegue
 * FAZER. O limite de portfólio dá ao plano um valor concreto, e a tensão
 * aparece no momento certo — quando o editor tenta publicar além do teto.
 */
export const FREE_PORTFOLIO_LIMIT = 5
export const PREMIUM_PORTFOLIO_LIMIT = 20

export function portfolioLimitFor(isPremium: boolean): number {
  return isPremium ? PREMIUM_PORTFOLIO_LIMIT : FREE_PORTFOLIO_LIMIT
}

/**
 * Faixa de avaliação usada para ordenar a busca de editores.
 *
 * O Premium NÃO deve atropelar a qualidade: um editor premium mediano
 * aparecendo à frente de um gratuito excelente piora a experiência de quem
 * contrata e a plataforma perde a venda. Então o plano é DESEMPATE dentro da
 * faixa, não sobreposição.
 *
 * Faixas de meia estrela (4.6 e 4.9 caem juntas em 4.5): fina o bastante para
 * preservar mérito, larga o bastante para o plano significar algo.
 */
export function ratingBandOf(avgRating: number): number {
  return Math.floor(avgRating * 2) / 2
}
