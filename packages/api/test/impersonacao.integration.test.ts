import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarEditor, criarCreator } from './fixtures'
import { impersonationService } from '../src/services/impersonation.service'
import { AuthService } from '../src/services/auth.service'

const auth = new AuthService()

async function criarAdmin() {
  return testPrisma.user.create({
    data: {
      name: 'Admin Teste',
      email: `admin-${Date.now()}-${Math.random()}@teste.local`,
      passwordHash: 'x',
      role: 'ADMIN',
    },
  })
}

beforeEach(async () => {
  await limparBanco()
})

describe('impersonação administrativa', () => {
  it('gera token com a identidade do ALVO, marcado com o admin real', async () => {
    const admin = await criarAdmin()
    const { user: editor } = await criarEditor()

    const r = await impersonationService.start(admin.id, editor.id)

    const payload = auth.verifyToken(r.token)
    expect(payload.sub).toBe(editor.id)      // identidade do alvo
    expect(payload.role).toBe('EDITOR')
    expect(payload.imp?.by).toBe(admin.id)   // mas rastreável até o admin
    expect(r.readOnly).toBe(true)
  })

  it('NÃO emite refresh token — a sessão expira e não se renova', async () => {
    const admin = await criarAdmin()
    const { user: editor } = await criarEditor()

    const r = await impersonationService.start(admin.id, editor.id)

    expect(r).not.toHaveProperty('refreshToken')
    expect(r.expiresInMinutes).toBe(15)
  })

  it('recusa impersonar outro ADMIN', async () => {
    const admin = await criarAdmin()
    const outro = await criarAdmin()

    await expect(impersonationService.start(admin.id, outro.id)).rejects.toMatchObject({ status: 403 })
  })

  it('recusa impersonar a si mesmo', async () => {
    const admin = await criarAdmin()
    await expect(impersonationService.start(admin.id, admin.id)).rejects.toMatchObject({ status: 400 })
  })

  it('recusa usuário inexistente', async () => {
    const admin = await criarAdmin()
    await expect(
      impersonationService.start(admin.id, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('funciona com criador, não só com editor', async () => {
    const admin = await criarAdmin()
    const creator = await criarCreator()

    const r = await impersonationService.start(admin.id, creator.id)
    expect(auth.verifyToken(r.token).role).toBe('CREATOR')
  })

  it('permite ver conta SUSPENSA — é justamente quando o admin precisa olhar', async () => {
    const admin = await criarAdmin()
    const { user: editor } = await criarEditor({ banned: true })

    const r = await impersonationService.start(admin.id, editor.id)
    expect(r.user.banned).toBe(true)
  })

  it('registra início e fim na auditoria, com quem viu quem', async () => {
    const admin = await criarAdmin()
    const { user: editor } = await criarEditor()

    await impersonationService.start(admin.id, editor.id)
    await impersonationService.end(admin.id, editor.id)

    const logs = await testPrisma.auditLog.findMany({
      where: { entityId: editor.id },
      orderBy: { createdAt: 'asc' },
    })
    const acoes = logs.map((l) => l.action)
    expect(acoes).toContain('IMPERSONATION_STARTED')
    expect(acoes).toContain('IMPERSONATION_ENDED')
    // o ator é o ADMIN, não o alvo — senão a trilha seria inútil
    expect(logs.every((l) => l.actorId === admin.id)).toBe(true)

    const inicio = logs.find((l) => l.action === 'IMPERSONATION_STARTED')
    expect(inicio?.metadata).toMatchObject({ targetEmail: editor.email, targetRole: 'EDITOR' })
  })
})

describe('guard de somente leitura', () => {
  // Testa a funcao de middleware diretamente: o custo/beneficio de subir o
  // Express inteiro aqui nao compensa, e a logica e toda deste guard.
  async function rodarGuard(method: string, imp: { by: string } | undefined) {
    const { readOnlyWhenImpersonating } = await import('../src/middlewares/impersonation.middleware')
    let status = 0
    let body: unknown = null
    let passou = false
    const req = { method, user: { sub: 'u1', role: 'EDITOR', imp } } as never
    const res = {
      status(c: number) { status = c; return this },
      json(b: unknown) { body = b; return this },
    } as never
    readOnlyWhenImpersonating(req, res, () => { passou = true })
    return { status, body, passou }
  }

  it('deixa passar GET durante impersonação', async () => {
    const r = await rodarGuard('GET', { by: 'admin-1' })
    expect(r.passou).toBe(true)
    expect(r.status).toBe(0)
  })

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('BLOQUEIA %s durante impersonação', async (m) => {
    const r = await rodarGuard(m, { by: 'admin-1' })
    expect(r.passou).toBe(false)
    expect(r.status).toBe(403)
    expect(r.body).toMatchObject({ impersonating: true })
  })

  it.each(['GET', 'POST', 'PATCH', 'DELETE'])('não interfere em sessão normal (%s)', async (m) => {
    const r = await rodarGuard(m, undefined)
    expect(r.passou).toBe(true)
    expect(r.status).toBe(0)
  })
})
