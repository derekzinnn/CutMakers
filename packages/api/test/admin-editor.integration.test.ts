import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarCategoria, criarCreator } from './fixtures'
import { orderService } from '../src/services/order.service'

/**
 * A conta ADMIN também é conta de editor (tem perfil, aparece na busca e pode publicar portfólio).
 * Contratá-la tem que funcionar — antes falhava com "Usuário selecionado não é editor".
 */
beforeEach(async () => {
  await limparBanco()
})

async function criarAdminEditor() {
  const user = await testPrisma.user.create({
    data: { name: 'Admin Editor', email: `admin-${Date.now()}@teste.local`, passwordHash: 'x', role: 'ADMIN' },
  })
  await testPrisma.editorProfile.create({ data: { userId: user.id } })
  return user
}

const dados = (editorId: string, categoryId: string) => ({
  editorId, categoryId, title: 'Vídeo teste', description: 'Briefing', budget: 100, files: [],
})

describe('pedido para um editor que é ADMIN', () => {
  it('criador contrata a conta admin', async () => {
    const [creator, admin, cat] = await Promise.all([criarCreator(), criarAdminEditor(), criarCategoria()])
    const order = await orderService.create(creator.id, dados(admin.id, cat.id))
    const gravado = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(gravado.editorId).toBe(admin.id)
    expect(gravado.status).toBe('NEGOTIATING')
  })

  it('continua bloqueando a auto-contratação', async () => {
    const [admin, cat] = await Promise.all([criarAdminEditor(), criarCategoria()])
    await expect(orderService.create(admin.id, dados(admin.id, cat.id))).rejects.toThrow(/si mesmo/i)
  })

  it('continua recusando quem não é editor (criador)', async () => {
    const [creator, outro, cat] = await Promise.all([criarCreator(), criarCreator(), criarCategoria()])
    await expect(orderService.create(creator.id, dados(outro.id, cat.id))).rejects.toThrow(/não é editor/i)
  })
})
