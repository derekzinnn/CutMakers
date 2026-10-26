/**
 * Exclusão DEFINITIVA (usuário e pedido) — ferramenta de limpeza de dados de teste.
 *
 * Fora de produção sempre liberada. Em produção só com ALLOW_USER_DELETION=true (opt-in explícito,
 * para limpar contas e pedidos de teste antes do lançamento). Desligue assim que houver usuários
 * reais: pedidos, pagamentos e auditoria são registro financeiro e jurídico.
 */
export function hardDeleteEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_USER_DELETION === 'true'
}
