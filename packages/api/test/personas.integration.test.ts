import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarCategoria } from './fixtures'
import { startPersona } from '../src/services/persona.service'
import { orderService } from '../src/services/order.service'

/**
 * Demonstração com um login só: o admin entra como criador e contrata o editor — seja a persona
 * editor, seja a própria conta admin (que também é editor).
 */
beforeEach(async () => {
  await limparBanco()
})

async function criarAdmin() {
  const admin = await testPrisma.user.create({
    data: { name: 'Admin Demo', email: `admin-${Date.now()}@teste.local`, passwordHash: 'x', role: 'ADMIN' },
  })
  await testPrisma.editorProfile.create({ data: { userId: admin.id } })
  return admin
}

const dados = (editorId: string, categoryId: string) => ({
  editorId, categoryId, title: 'Vídeo da demo', description: 'Briefing', budget: 150, files: [],
})

describe('personas do admin', () => {
  it('persona editor nasce com perfil de editor (aparece na busca)', async () => {
    const admin = await criarAdmin()
    const { user } = await startPersona(admin.id, 'EDITOR')
    expect(await testPrisma.editorProfile.findUnique({ where: { userId: user.id } })).not.toBeNull()
    // idempotente: entrar de novo não duplica nem falha
    await startPersona(admin.id, 'EDITOR')
    expect(await testPrisma.editorProfile.count({ where: { userId: user.id } })).toBe(1)
  })

  it('persona criador contrata a persona editor', async () => {
    const [admin, cat] = await Promise.all([criarAdmin(), criarCategoria()])
    const criador = (await startPersona(admin.id, 'CREATOR')).user
    const editor = (await startPersona(admin.id, 'EDITOR')).user
    const order = await orderService.create(criador.id, dados(editor.id, cat.id))
    const gravado = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(gravado.creatorId).toBe(criador.id)
    expect(gravado.editorId).toBe(editor.id)
  })

  it('persona criador contrata a própria conta admin como editor', async () => {
    const [admin, cat] = await Promise.all([criarAdmin(), criarCategoria()])
    const criador = (await startPersona(admin.id, 'CREATOR')).user
    const order = await orderService.create(criador.id, dados(admin.id, cat.id))
    const gravado = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(gravado.editorId).toBe(admin.id)
  })
})
