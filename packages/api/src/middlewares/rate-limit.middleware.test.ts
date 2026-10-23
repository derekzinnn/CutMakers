import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Request, Response } from 'express'
import { rateLimit, resetRateLimits } from './rate-limit.middleware'

// NODE_ENV=test desliga o limitador por padrão; aqui o testamos de verdade.
function fakeReq(ip = '1.1.1.1', body: Record<string, unknown> = {}): Request {
  return { ip, body, socket: { remoteAddress: ip } } as unknown as Request
}

function fakeRes() {
  const headers: Record<string, string> = {}
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader: (k: string, v: string) => { headers[k] = v },
    status(code: number) { res.statusCode = code; return res },
    json(b: unknown) { res.body = b; return res },
  }
  return { res: res as unknown as Response & typeof res, headers }
}

function hit(mw: ReturnType<typeof rateLimit>, req: Request) {
  const { res, headers } = fakeRes()
  const next = vi.fn()
  mw(req, res, next)
  return { res, headers, passed: next.mock.calls.length === 1 }
}

describe('rateLimit', () => {
  const prev = process.env.NODE_ENV
  beforeEach(() => {
    process.env.NODE_ENV = 'development'
    delete process.env.RATE_LIMIT_DISABLED
    resetRateLimits()
  })
  afterEach(() => {
    process.env.NODE_ENV = prev
    vi.useRealTimers()
  })

  it('deixa passar até o máximo e bloqueia a seguinte com 429 + Retry-After', () => {
    const mw = rateLimit({ name: 't1', windowMs: 60_000, max: 3 })
    for (let i = 0; i < 3; i++) expect(hit(mw, fakeReq()).passed).toBe(true)

    const blocked = hit(mw, fakeReq())
    expect(blocked.passed).toBe(false)
    expect(blocked.res.statusCode).toBe(429)
    expect(Number(blocked.headers['Retry-After'])).toBeGreaterThanOrEqual(1)
  })

  it('conta por IP: outro IP não é afetado', () => {
    const mw = rateLimit({ name: 't2', windowMs: 60_000, max: 1 })
    expect(hit(mw, fakeReq('1.1.1.1')).passed).toBe(true)
    expect(hit(mw, fakeReq('1.1.1.1')).passed).toBe(false)
    expect(hit(mw, fakeReq('2.2.2.2')).passed).toBe(true)
  })

  it('contadores de rotas diferentes são independentes (mesmo IP)', () => {
    const a = rateLimit({ name: 'rota-a', windowMs: 60_000, max: 1 })
    const b = rateLimit({ name: 'rota-b', windowMs: 60_000, max: 1 })
    expect(hit(a, fakeReq()).passed).toBe(true)
    expect(hit(b, fakeReq()).passed).toBe(true)
    expect(hit(a, fakeReq()).passed).toBe(false)
  })

  it('a janela expira e o contador recomeça', () => {
    vi.useFakeTimers()
    const mw = rateLimit({ name: 't3', windowMs: 1_000, max: 1 })
    expect(hit(mw, fakeReq()).passed).toBe(true)
    expect(hit(mw, fakeReq()).passed).toBe(false)
    vi.advanceTimersByTime(1_001)
    expect(hit(mw, fakeReq()).passed).toBe(true)
  })

  it('chave por e-mail: martelar UMA conta de IPs diferentes é barrado, outra conta não', () => {
    const mw = rateLimit({
      name: 'login-email',
      windowMs: 60_000,
      max: 2,
      key: (req) => (req.body as { email?: string }).email ?? null,
    })
    expect(hit(mw, fakeReq('1.1.1.1', { email: 'a@x.com' })).passed).toBe(true)
    expect(hit(mw, fakeReq('2.2.2.2', { email: 'a@x.com' })).passed).toBe(true)
    expect(hit(mw, fakeReq('3.3.3.3', { email: 'a@x.com' })).passed).toBe(false)
    expect(hit(mw, fakeReq('3.3.3.3', { email: 'b@x.com' })).passed).toBe(true)
  })

  it('chave null ignora o limite (ex.: body sem e-mail)', () => {
    const mw = rateLimit({ name: 't4', windowMs: 60_000, max: 1, key: () => null })
    for (let i = 0; i < 5; i++) expect(hit(mw, fakeReq()).passed).toBe(true)
  })

  it('fica desligado com NODE_ENV=test e com RATE_LIMIT_DISABLED=true', () => {
    const mw = rateLimit({ name: 't5', windowMs: 60_000, max: 1 })
    process.env.NODE_ENV = 'test'
    for (let i = 0; i < 5; i++) expect(hit(mw, fakeReq()).passed).toBe(true)

    process.env.NODE_ENV = 'development'
    process.env.RATE_LIMIT_DISABLED = 'true'
    for (let i = 0; i < 5; i++) expect(hit(mw, fakeReq()).passed).toBe(true)
  })
})
