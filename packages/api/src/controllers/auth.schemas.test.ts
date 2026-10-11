import { describe, it, expect } from 'vitest'
import { emailField, registerSchema, loginSchema } from './auth.controller'

/**
 * O unique de User.email é case-sensitive no Postgres. Sem normalização,
 * "Derek@Gmail.com" criava uma segunda conta ao lado de "derek@gmail.com", e
 * quem digitasse a caixa errada no login levava "Credenciais inválidas" com a
 * senha certa.
 */
describe('normalização de email', () => {
  it.each([
    ['Derek@Gmail.com', 'derek@gmail.com'],
    ['  derek@gmail.com  ', 'derek@gmail.com'],
    ['DEREK@GMAIL.COM', 'derek@gmail.com'],
    ['Derek.Cavalcanti1@Gmail.COM', 'derek.cavalcanti1@gmail.com'],
  ])('%s → %s', (entrada, esperado) => {
    expect(emailField.parse(entrada)).toBe(esperado)
  })

  it('todas as variações de caixa do mesmo email colapsam em um', () => {
    const variantes = ['Derek@Gmail.com', 'derek@gmail.com', 'DEREK@GMAIL.COM', ' Derek@GMAIL.com ']
    const normalizados = new Set(variantes.map((v) => emailField.parse(v)))
    expect(normalizados.size).toBe(1)
  })

  it('continua rejeitando email inválido', () => {
    for (const ruim of ['nao-eh-email', '@gmail.com', 'a@', '']) {
      expect(emailField.safeParse(ruim).success).toBe(false)
    }
  })

  it('normaliza pelo mesmo caminho no registro e no login', () => {
    const email = 'Derek@Gmail.com'
    const reg = registerSchema.parse({
      name: 'Derek',
      email,
      password: 'senha-de-teste-123',
      role: 'CREATOR',
      acceptTerms: true,
    })
    const log = loginSchema.parse({ email, password: 'senha-de-teste-123' })
    expect(reg.email).toBe(log.email)
  })
})

describe('regras do cadastro', () => {
  const base = {
    name: 'Derek',
    email: 'derek@gmail.com',
    password: 'senha-de-teste-123',
    role: 'CREATOR' as const,
    acceptTerms: true as const,
  }

  it('exige aceite dos Termos de Uso', () => {
    // Regra do briefing: o aceite grava User.termsAcceptedAt
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false)
    const semCampo = { ...base } as Record<string, unknown>
    delete semCampo.acceptTerms
    expect(registerSchema.safeParse(semCampo).success).toBe(false)
  })

  it('exige senha de ao menos 8 caracteres', () => {
    expect(registerSchema.safeParse({ ...base, password: '1234567' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, password: '12345678' }).success).toBe(true)
  })

  it('não aceita ADMIN nem BOTH no cadastro público', () => {
    // Admins só via seed — nunca por endpoint público
    expect(registerSchema.safeParse({ ...base, role: 'ADMIN' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, role: 'BOTH' }).success).toBe(false)
  })

  it('aplica trim no nome', () => {
    expect(registerSchema.parse({ ...base, name: '  Derek  ' }).name).toBe('Derek')
  })
})
