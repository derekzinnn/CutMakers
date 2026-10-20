import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarPedido } from './fixtures'
import { orderService } from '../src/services/order.service'

beforeEach(async () => {
  await limparBanco()
})

/**
 * Regressão do achado 2 do code review: o commit 34a4896 trocou a lógica do gate
 * por `filesHidden: false` hardcoded, liberando as URLs Cloudinary do material
 * bruto do criador para o editor ANTES do pagamento. Uma vez entregue, um link
 * não pode ser "desentregue" — por isso vale um teste permanente.
 */
describe('gate de arquivos do criador', () => {
  for (const status of ['NEGOTIATING', 'AWAITING_PAYMENT', 'PENDING'] as const) {
    it(`editor NÃO recebe as URLs em ${status}`, async () => {
      const { order, editor } = await criarPedido({ status, comArquivos: 3 })

      const visto = await orderService.getById(order.id, editor.id, false)

      expect(visto.filesHidden).toBe(true)
      expect(visto.files).toEqual([])
      // mas sabe que existe material esperando por ele
      expect(visto.filesCount).toBe(3)
    })
  }

  for (const status of ['IN_PROGRESS', 'DELIVERED', 'COMPLETED'] as const) {
    it(`editor recebe as URLs em ${status} (pagamento já em custódia)`, async () => {
      const { order, editor } = await criarPedido({ status, comArquivos: 3 })

      const visto = await orderService.getById(order.id, editor.id, false)

      expect(visto.filesHidden).toBe(false)
      expect(visto.files).toHaveLength(3)
      expect(visto.files[0].fileUrl).toContain('cloudinary')
    })
  }

  it('o criador sempre vê os próprios arquivos, inclusive em NEGOTIATING', async () => {
    const { order, creator } = await criarPedido({ status: 'NEGOTIATING', comArquivos: 2 })

    const visto = await orderService.getById(order.id, creator.id, false)

    expect(visto.filesHidden).toBe(false)
    expect(visto.files).toHaveLength(2)
  })

  it('admin vê os arquivos em qualquer status (mediação de disputa)', async () => {
    const { order } = await criarPedido({ status: 'NEGOTIATING', comArquivos: 2 })
    const admin = await testPrisma.user.create({
      data: { name: 'Admin', email: `admin-${Date.now()}@teste.local`, passwordHash: 'x', role: 'ADMIN' },
    })

    const visto = await orderService.getById(order.id, admin.id, true)

    expect(visto.filesHidden).toBe(false)
    expect(visto.files).toHaveLength(2)
  })

  it('a LISTAGEM nunca devolve URL — só a contagem', async () => {
    // Furo que eu achei ao restaurar o gate: `GET /orders` expunha as mesmas URLs
    // por outro caminho, então restaurar só o detalhe seria teatro.
    const { editor } = await criarPedido({ status: 'NEGOTIATING', comArquivos: 3 })

    const lista = await orderService.list({ userId: editor.id, isAdmin: false, role: 'editor' })

    expect(lista.orders).toHaveLength(1)
    expect(lista.orders[0].filesCount).toBe(3)
    expect(JSON.stringify(lista.orders[0])).not.toContain('cloudinary')
    expect(lista.orders[0]).not.toHaveProperty('files')
  })

  it('terceiro sem relação com o pedido é barrado', async () => {
    const { order } = await criarPedido({ status: 'IN_PROGRESS', comArquivos: 2 })
    const estranho = await testPrisma.user.create({
      data: { name: 'Estranho', email: `x-${Date.now()}@teste.local`, passwordHash: 'x', role: 'EDITOR' },
    })

    await expect(orderService.getById(order.id, estranho.id, false)).rejects.toMatchObject({ status: 403 })
  })
})
