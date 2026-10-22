import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarPedido, criarTransacaoHeld } from './fixtures'
import { disputeService } from '../src/services/dispute.service'

/**
 * Disputas movem dinheiro em escrow, então valem teste contra Postgres real.
 *
 * Fluxo: criador abre disputa (pedido congela em DISPUTED, valor fica retido) →
 * admin resolve liberando (RELEASE → editor recebe) ou reembolsando (REFUND →
 * criador recebe de volta).
 */
beforeEach(async () => {
  await limparBanco()
})

/** Admin para resolver disputas. */
async function criarAdmin() {
  return testPrisma.user.create({
    data: { name: 'Admin', email: `admin-${Date.now()}-${Math.random()}@teste.local`, passwordHash: 'x', role: 'ADMIN' },
  })
}

describe('disputas', () => {
  it('abrir disputa congela o pedido em DISPUTED e notifica editor + admins', async () => {
    const admin = await criarAdmin()
    const { order, creator, editor } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)

    await disputeService.openDispute(order.id, creator.id, 'Entrega fora do briefing')

    const atual = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(atual.status).toBe('DISPUTED')

    const disputa = await testPrisma.dispute.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(disputa.status).toBe('OPEN')
    expect(disputa.reason).toBe('Entrega fora do briefing')

    // Notifica o editor e o admin
    const notifs = await testPrisma.notification.findMany({ where: { type: 'DISPUTE_OPENED' } })
    const alvos = notifs.map((n) => n.userId)
    expect(alvos).toContain(editor.id)
    expect(alvos).toContain(admin.id)
  })

  it('só o criador abre disputa, e só em DELIVERED/REVISION_REQUESTED', async () => {
    const { order, creator, editor } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)

    // editor não pode abrir
    await expect(disputeService.openDispute(order.id, editor.id, 'x')).rejects.toMatchObject({ status: 403 })

    // criador em status inválido não pode
    const outro = await criarPedido({ status: 'IN_PROGRESS' })
    await expect(
      disputeService.openDispute(outro.order.id, outro.creator.id, 'x'),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('uma disputa por pedido', async () => {
    const { order, creator, editor } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)
    await disputeService.openDispute(order.id, creator.id, 'primeira')
    await expect(disputeService.openDispute(order.id, creator.id, 'segunda')).rejects.toMatchObject({ status: 400 })
  })

  it('RELEASE: escrow vai pro editor, pedido COMPLETED, +1 trabalho', async () => {
    const admin = await criarAdmin()
    const { order, creator, editor, editorProfile } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)
    await disputeService.openDispute(order.id, creator.id, 'x')

    await disputeService.resolveDispute(order.id, admin.id, 'RELEASE')

    const atual = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(atual.status).toBe('COMPLETED')
    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(tx.status).toBe('RELEASED')
    const prof = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: editorProfile.id } })
    expect(prof.totalJobs).toBe(1)

    const disputa = await testPrisma.dispute.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(disputa.status).toBe('RESOLVED_RELEASED')
  })

  it('REFUND: escrow volta pro criador, pedido CANCELLED, SEM +1 trabalho', async () => {
    const admin = await criarAdmin()
    const { order, creator, editor, editorProfile } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)
    await disputeService.openDispute(order.id, creator.id, 'x')

    await disputeService.resolveDispute(order.id, admin.id, 'REFUND')

    const atual = await testPrisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(atual.status).toBe('CANCELLED')
    const tx = await testPrisma.transaction.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(tx.status).toBe('REFUNDED')
    const prof = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: editorProfile.id } })
    expect(prof.totalJobs).toBe(0)

    const disputa = await testPrisma.dispute.findUniqueOrThrow({ where: { orderId: order.id } })
    expect(disputa.status).toBe('RESOLVED_REFUNDED')
  })

  it('não resolve disputa que não está aberta', async () => {
    const admin = await criarAdmin()
    const { order, creator, editor } = await criarPedido({ status: 'DELIVERED' })
    await criarTransacaoHeld(order.id, creator.id, editor.id)
    await disputeService.openDispute(order.id, creator.id, 'x')
    await disputeService.resolveDispute(order.id, admin.id, 'RELEASE')
    // segunda resolução falha
    await expect(disputeService.resolveDispute(order.id, admin.id, 'REFUND')).rejects.toMatchObject({ status: 400 })
  })
})
