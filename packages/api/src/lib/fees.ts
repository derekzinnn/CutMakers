import { Prisma } from '@prisma/client'

/**
 * Taxa da plataforma — FONTE ÚNICA.
 *
 * Antes isto existia em três declarações independentes (order.service,
 * proposal.service, project-request.service) e um "10%" escrito à mão no
 * template do contrato. Mudar a taxa exigia acertar os quatro, e esquecer o
 * template geraria contratos assinados eletronicamente informando um
 * percentual diferente do efetivamente cobrado — o termo é o documento de
 * aceite das partes, não é um detalhe de UI.
 *
 * Decimal, não float: `0.1 * 3` não é `0.3` em ponto flutuante, e isto
 * multiplica valores que vão para o banco e para o contrato.
 */
export const PLATFORM_FEE_RATE = new Prisma.Decimal('0.10')

/** "10%" — derivado da taxa, para o texto do contrato nunca divergir dela. */
export const PLATFORM_FEE_LABEL = `${PLATFORM_FEE_RATE.mul(100).toDecimalPlaces(2).toNumber()}%`

/**
 * Taxa sobre um valor, em Decimal com 2 casas.
 * Use nos caminhos que gravam no banco.
 */
export function platformFeeOf(amount: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(amount).mul(PLATFORM_FEE_RATE).toDecimalPlaces(2)
}

/** Mesma taxa como number, para DTOs e previews. */
export function platformFeeAsNumber(amount: Prisma.Decimal | number | string): number {
  return platformFeeOf(amount).toNumber()
}

/** Valor líquido ao editor (valor − taxa), como number. */
export function netAmountAsNumber(amount: Prisma.Decimal | number | string): number {
  const gross = new Prisma.Decimal(amount)
  return gross.minus(platformFeeOf(gross)).toDecimalPlaces(2).toNumber()
}
