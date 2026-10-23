import { describe, expect, it } from 'vitest'
import { listDays, parseRange, previousRange } from './admin-dashboard.service'

describe('dashboard do admin: períodos', () => {
  it('um dia só: 1 dia, fim exclusivo = meia-noite seguinte (Brasília)', () => {
    const r = parseRange('2026-10-01', '2026-10-01')
    expect(r.days).toBe(1)
    expect(r.start.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(r.end.toISOString()).toBe('2026-10-02T03:00:00.000Z')
  })

  it('período inclusivo cruzando meses (29/set a 1/out = 3 dias)', () => {
    const r = parseRange('2026-09-29', '2026-10-01')
    expect(r.days).toBe(3)
    expect(listDays(r)).toEqual(['2026-09-29', '2026-09-30', '2026-10-01'])
  })

  it('período anterior tem o mesmo tamanho e termina onde o atual começa', () => {
    const r = parseRange('2026-10-08', '2026-10-14')
    const p = previousRange(r)
    expect(p.days).toBe(7)
    expect(p.end.getTime()).toBe(r.start.getTime())
    expect(listDays(p)[0]).toBe('2026-10-01')
  })

  it('recusa formato errado, ordem invertida e períodos longos demais', () => {
    expect(() => parseRange('01/10/2026', '2026-10-02')).toThrow()
    expect(() => parseRange('2026-10-05', '2026-10-01')).toThrow()
    expect(() => parseRange('2025-01-01', '2026-10-01')).toThrow()
  })
})
