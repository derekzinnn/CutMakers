import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarCategoria, criarCreator, criarEditor } from './fixtures'
import { projectRequestService } from '../src/services/project-request.service'

/**
 * Trava de termos da solicitação: depois que um editor manda proposta, o
 * criador não pode mais mudar orçamento, prazo nem descrição (o que o editor
 * usou para precificar). Título e links seguem editáveis.
 */
beforeEach(async () => {
  await limparBanco()
})

async function solicitacaoComProposta() {
  const categoria = await criarCategoria()
  const creator = await criarCreator()
  const { user: editor } = await criarEditor()

  const req = await projectRequestService.createRequest(creator.id, {
    categoryId: categoria.id,
    title: 'Edição de podcast',
    description: 'Cortar 2h em 40min',
    budgetMin: 200,
    budgetMax: 400,
  })
  await projectRequestService.sendProposal(req.id, editor.id, {
    amount: 300,
    deliveryDays: 5,
    message: 'Fecho por 300',
  })
  return { requestId: req.id, creatorId: creator.id }
}

describe('trava de termos após 1ª proposta', () => {
  it('bloqueia mudar orçamento com proposta pendente', async () => {
    const { requestId, creatorId } = await solicitacaoComProposta()
    await expect(
      projectRequestService.updateRequest(requestId, creatorId, { budgetMax: 1000 }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('bloqueia mudar descrição (escopo) e prazo', async () => {
    const { requestId, creatorId } = await solicitacaoComProposta()
    await expect(
      projectRequestService.updateRequest(requestId, creatorId, { description: 'Escopo totalmente novo' }),
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      projectRequestService.updateRequest(requestId, creatorId, { deadline: new Date(Date.now() + 9e8) }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('PERMITE editar título e links mesmo com proposta', async () => {
    const { requestId, creatorId } = await solicitacaoComProposta()
    const r = await projectRequestService.updateRequest(requestId, creatorId, {
      title: 'Edição de podcast (urgente)',
      referenceLinks: ['https://exemplo.com/ref'],
    })
    expect(r.title).toContain('urgente')
  })

  it('SEM proposta, edita tudo normalmente', async () => {
    const categoria = await criarCategoria()
    const creator = await criarCreator()
    const req = await projectRequestService.createRequest(creator.id, {
      categoryId: categoria.id, title: 'x', description: 'y', budgetMin: 100, budgetMax: 200,
    })
    const r = await projectRequestService.updateRequest(req.id, creator.id, {
      budgetMax: 500, description: 'novo escopo',
    })
    expect(r.budgetMax).toBe(500)
  })
})
