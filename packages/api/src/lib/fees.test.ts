import { describe, it, expect } from 'vitest'
import {
  PLATFORM_FEE_RATE,
  PLATFORM_FEE_LABEL,
  platformFeeOf,
  platformFeeAsNumber,
  netAmountAsNumber,
} from './fees'

describe('taxa da plataforma', () => {
  it('é a fonte única usada por pedidos, propostas, solicitações e contrato', () => {
    expect(PLATFORM_FEE_RATE.toString()).toBe('0.1')
  })

  it('deriva o rótulo do contrato da própria taxa', () => {
    // O termo é o documento de aceite eletrônico das partes: se o texto
    // divergir da taxa cobrada, o contrato informa um percentual errado.
    //
    // Asserção deliberadamente indireta: comparar com '10%' passaria mesmo se o
    // rótulo voltasse a ser hardcoded. Aqui o percentual do texto é extraído e
    // aplicado a um valor — se ele deixar de acompanhar PLATFORM_FEE_RATE, falha.
    expect(PLATFORM_FEE_LABEL).toMatch(/^[\d.]+%$/)

    const percentualDoTexto = Number(PLATFORM_FEE_LABEL.replace('%', ''))
    const valor = 1000
    expect((valor * percentualDoTexto) / 100).toBe(platformFeeAsNumber(valor))
  })

  // Valores escolhidos por quebrarem em ponto flutuante
  it.each([
    [200, 20, 180],
    [199.99, 20, 179.99],
    [1234.56, 123.46, 1111.1],
    [39.9, 3.99, 35.91],
    [0.07, 0.01, 0.06],
  ])('R$ %s → taxa %s, líquido %s', (amount, fee, net) => {
    expect(platformFeeAsNumber(amount)).toBe(fee)
    expect(netAmountAsNumber(amount)).toBe(net)
  })

  it('taxa + líquido sempre fecham no valor cheio', () => {
    for (const amount of [200, 199.99, 1234.56, 39.9, 0.07, 10.05, 3333.33]) {
      const soma = platformFeeAsNumber(amount) + netAmountAsNumber(amount)
      expect(soma.toFixed(2)).toBe(amount.toFixed(2))
    }
  })

  it('nunca devolve mais de 2 casas decimais', () => {
    // Centavos fracionados viram erro de arredondamento no escrow
    for (const amount of [0.07, 33.333, 1.005, 99.999]) {
      expect(platformFeeOf(amount).decimalPlaces()).toBeLessThanOrEqual(2)
    }
  })

  it('aceita Decimal, number e string sem divergir', () => {
    expect(platformFeeAsNumber('199.99')).toBe(platformFeeAsNumber(199.99))
    expect(platformFeeAsNumber(PLATFORM_FEE_RATE.mul(1000))).toBe(platformFeeAsNumber(100))
  })
})
