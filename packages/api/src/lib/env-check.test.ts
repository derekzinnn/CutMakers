import { describe, it, expect, vi, afterEach } from 'vitest'
import { checkAuthSecrets, assertAuthSecrets } from './env-check'

const good = {
  JWT_SECRET: 'k3Jd9sL0pQ7vXz2mB8nR5tY1wE6uI4oA9cF2gH7jK0lM',
  JWT_REFRESH_SECRET: 'Zx8Cv1Bn4Mq7Wr0Ty3Ui6Op9As2Df5Gh8Jk1Lz4Xc7Vb',
}

const env = (e: Record<string, string | undefined>) => e as unknown as NodeJS.ProcessEnv

describe('checkAuthSecrets', () => {
  it('segredos fortes e distintos: sem erro nem aviso', () => {
    expect(checkAuthSecrets(env(good))).toEqual({ errors: [], warnings: [] })
  })

  it('ausente é erro', () => {
    const r = checkAuthSecrets(env({ JWT_SECRET: good.JWT_SECRET }))
    expect(r.errors.join()).toMatch(/JWT_REFRESH_SECRET não está definido/)
  })

  it('placeholder (o do .env.example) é erro', () => {
    const r = checkAuthSecrets(env({
      JWT_SECRET: 'troque-por-uma-string-secreta-longa',
      JWT_REFRESH_SECRET: good.JWT_REFRESH_SECRET,
    }))
    expect(r.errors.join()).toMatch(/JWT_SECRET parece um valor de exemplo/)
  })

  it('iguais é erro (refresh seria aceito como access)', () => {
    const r = checkAuthSecrets(env({ JWT_SECRET: good.JWT_SECRET, JWT_REFRESH_SECRET: good.JWT_SECRET }))
    expect(r.errors.join()).toMatch(/são iguais/)
  })

  it('curto é só aviso, não erro', () => {
    const r = checkAuthSecrets(env({ JWT_SECRET: 'aB3dE5gH7jK9mN1p', JWT_REFRESH_SECRET: 'qR2tV4xZ6bD8fH0k' }))
    expect(r.errors).toEqual([])
    expect(r.warnings).toHaveLength(2)
  })
})

describe('assertAuthSecrets', () => {
  afterEach(() => vi.restoreAllMocks())

  it('produção + config inválida derruba o boot', () => {
    expect(() =>
      assertAuthSecrets(env({ NODE_ENV: 'production', JWT_SECRET: good.JWT_SECRET })),
    ).toThrow(/Configuração de segurança inválida/)
  })

  it('dev + config inválida só avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => assertAuthSecrets(env({ NODE_ENV: 'development' }))).not.toThrow()
    expect(warn).toHaveBeenCalled()
  })

  it('produção + config boa passa', () => {
    expect(() => assertAuthSecrets(env({ NODE_ENV: 'production', ...good }))).not.toThrow()
  })
})
