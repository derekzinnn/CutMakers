import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarCreator } from './fixtures'

/**
 * Banimento precisa encerrar a sessão. O authMiddleware só verifica a assinatura do
 * JWT (sem query por request, de propósito), então o ponto de revalidação é o
 * /auth/refresh: sem a checagem de `banned` ali, o front renovaria o par de tokens
 * a cada 401 e um banido ficaria logado para sempre.
 *
 * Isto precisa passar pela camada HTTP (supertest): a regra mora no controller,
 * não num service que dê para chamar direto.
 */
let app: import('express').Express

beforeAll(async () => {
  // Os segredos só precisam existir; o valor é irrelevante para o teste
  process.env.JWT_SECRET ??= 'segredo-de-teste-access'
  process.env.JWT_REFRESH_SECRET ??= 'segredo-de-teste-refresh'
  process.env.JWT_EXPIRES_IN ??= '15m'
  process.env.JWT_REFRESH_EXPIRES_IN ??= '7d'
  app = (await import('../src/app')).app
})

beforeEach(async () => {
  await limparBanco()
})

async function tokensDe(userId: string, role: 'CREATOR' | 'EDITOR' = 'CREATOR') {
  const { AuthService } = await import('../src/services/auth.service')
  return new AuthService().generateTokens(userId, role)
}

describe('banimento encerra a sessão', () => {
  it('refresh de usuário ativo renova o par de tokens', async () => {
    const user = await criarCreator()
    const { refreshToken } = await tokensDe(user.id)

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.refreshToken).toBeTruthy()
  })

  it('refresh de usuário BANIDO é recusado (401)', async () => {
    const user = await criarCreator()
    const { refreshToken } = await tokensDe(user.id)

    // o token foi emitido ANTES do ban — é exatamente o cenário a barrar
    await testPrisma.user.update({ where: { id: user.id }, data: { banned: true } })

    const res = await request(app).post('/api/auth/refresh').send({ refreshToken })
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/suspensa/i)
    expect(res.body.token).toBeUndefined()
  })

  it('desbanir restabelece o refresh', async () => {
    const user = await criarCreator()
    const { refreshToken } = await tokensDe(user.id)

    await testPrisma.user.update({ where: { id: user.id }, data: { banned: true } })
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken })).status).toBe(401)

    await testPrisma.user.update({ where: { id: user.id }, data: { banned: false } })
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken })).status).toBe(200)
  })

  it('refresh sem token é 400 e token forjado é 401', async () => {
    expect((await request(app).post('/api/auth/refresh').send({})).status).toBe(400)
    const forjado = await request(app).post('/api/auth/refresh').send({ refreshToken: 'nao.e.um.jwt' })
    expect(forjado.status).toBe(401)
  })

  it('o access token NÃO serve como refresh (segredos separados)', async () => {
    const user = await criarCreator()
    const { token } = await tokensDe(user.id)
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: token })
    expect(res.status).toBe(401)
  })

  it('login de conta banida é recusado (401)', async () => {
    const bcrypt = await import('bcryptjs').catch(() => import('bcrypt'))
    const hash = await bcrypt.hash('senha-correta-123', 4)
    const email = `banido-${Date.now()}@teste.local`
    await testPrisma.user.create({
      data: { name: 'Banido', email, passwordHash: hash, role: 'CREATOR', banned: true },
    })

    const res = await request(app).post('/api/auth/login').send({ email, password: 'senha-correta-123' })
    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/suspensa/i)
  })
})
