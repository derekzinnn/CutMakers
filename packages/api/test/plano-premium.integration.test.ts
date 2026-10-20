import { describe, it, expect, beforeEach } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarEditor, criarCategoria } from './fixtures'
import { PortfolioService } from '../src/services/portfolio.service'
import { EditorService } from '../src/services/editor.service'
import { FREE_PORTFOLIO_LIMIT, PREMIUM_PORTFOLIO_LIMIT, ratingBandOf } from '../src/lib/plans'

// Estes dois services exportam so a classe (sem singleton, ao contrario dos demais)
const portfolioService = new PortfolioService()
const editorService = new EditorService()

beforeEach(async () => {
  await limparBanco()
})

async function publicar(userId: string, categoryId: string, i: number) {
  return portfolioService.create(userId, {
    categoryId,
    title: `Video ${i}`,
    description: 'teste',
    videoUrl: `https://cdn/v${i}.mp4`,
    thumbnailUrl: `https://cdn/t${i}.jpg`,
    basePrice: 100,
  })
}

describe('limite de portfólio por plano', () => {
  it(`editor grátis publica até ${FREE_PORTFOLIO_LIMIT} e é bloqueado no seguinte`, async () => {
    const cat = await criarCategoria()
    const { user } = await criarEditor()

    for (let i = 0; i < FREE_PORTFOLIO_LIMIT; i++) {
      await publicar(user.id, cat.id, i)
    }

    await expect(publicar(user.id, cat.id, 99)).rejects.toMatchObject({ status: 400 })
    // a mensagem precisa dizer o caminho de saída, não só "não pode"
    await expect(publicar(user.id, cat.id, 99)).rejects.toThrow(/Premium/i)

    const total = await testPrisma.portfolioItem.count()
    expect(total).toBe(FREE_PORTFOLIO_LIMIT)
  })

  it(`editor premium publica até ${PREMIUM_PORTFOLIO_LIMIT}`, async () => {
    const cat = await criarCategoria()
    const { user, profile } = await criarEditor()
    await testPrisma.editorProfile.update({ where: { id: profile.id }, data: { isPremium: true } })

    for (let i = 0; i < PREMIUM_PORTFOLIO_LIMIT; i++) {
      await publicar(user.id, cat.id, i)
    }
    await expect(publicar(user.id, cat.id, 99)).rejects.toMatchObject({ status: 400 })

    expect(await testPrisma.portfolioItem.count()).toBe(PREMIUM_PORTFOLIO_LIMIT)
  })

  it('quem já passou do limite MANTÉM o que tem — o bloqueio é só para itens novos', async () => {
    // Cenário real: editor publicou antes da regra, ou era premium e expirou
    const cat = await criarCategoria()
    const { user, profile } = await criarEditor()
    await testPrisma.editorProfile.update({ where: { id: profile.id }, data: { isPremium: true } })
    for (let i = 0; i < 8; i++) await publicar(user.id, cat.id, i)

    // assinatura expira
    await testPrisma.editorProfile.update({ where: { id: profile.id }, data: { isPremium: false } })

    // os 8 continuam lá — nada foi removido
    expect(await testPrisma.portfolioItem.count()).toBe(8)
    // mas não adiciona o 9º
    await expect(publicar(user.id, cat.id, 99)).rejects.toMatchObject({ status: 400 })

    // liberar espaço volta a permitir? não: 7 ainda é > 5
    const itens = await testPrisma.portfolioItem.findMany({ take: 1 })
    await portfolioService.delete(itens[0].id, user.id, false)
    await expect(publicar(user.id, cat.id, 98)).rejects.toMatchObject({ status: 400 })
  })

  it('remover até abaixo do teto libera a publicação de novo', async () => {
    const cat = await criarCategoria()
    const { user } = await criarEditor()
    for (let i = 0; i < FREE_PORTFOLIO_LIMIT; i++) await publicar(user.id, cat.id, i)
    await expect(publicar(user.id, cat.id, 99)).rejects.toThrow()

    const item = await testPrisma.portfolioItem.findFirstOrThrow()
    await portfolioService.delete(item.id, user.id, false)

    const novo = await publicar(user.id, cat.id, 100)
    expect(novo.id).toBeTruthy()
    expect(await testPrisma.portfolioItem.count()).toBe(FREE_PORTFOLIO_LIMIT)
  })
})

describe('prioridade do Premium na busca', () => {
  async function editorCom(nome: string, avgRating: number, isPremium: boolean, totalJobs = 0) {
    const { user, profile } = await criarEditor()
    await testPrisma.user.update({ where: { id: user.id }, data: { name: nome } })
    await testPrisma.editorProfile.update({
      where: { id: profile.id },
      data: { avgRating, ratingBand: ratingBandOf(avgRating), isPremium, totalJobs },
    })
    return user.id
  }

  it('Premium NÃO atropela quem tem nota melhor', async () => {
    // Era o comportamento antigo: isPremium vinha primeiro no orderBy
    await editorCom('Premium Mediano', 3.2, true)
    await editorCom('Gratuito Excelente', 4.9, false)

    const { editors } = await editorService.listEditors({})
    expect(editors[0].name).toBe('Gratuito Excelente')
    expect(editors[1].name).toBe('Premium Mediano')
  })

  it('Premium desempata DENTRO da mesma faixa', async () => {
    // 4.6 e 4.9 caem na mesma faixa (4.5), então o plano decide
    await editorCom('Gratuito 4.9', 4.9, false)
    await editorCom('Premium 4.6', 4.6, true)

    const { editors } = await editorService.listEditors({})
    expect(editors[0].name).toBe('Premium 4.6')
    expect(editors[1].name).toBe('Gratuito 4.9')
  })

  it('editor novo sem avaliação: Premium ajuda a ser descoberto entre os novos', async () => {
    await editorCom('Novo Gratuito', 0, false)
    await editorCom('Novo Premium', 0, true)

    const { editors } = await editorService.listEditors({})
    expect(editors[0].name).toBe('Novo Premium')
  })

  it('faixas são de meia estrela', () => {
    expect(ratingBandOf(4.9)).toBe(4.5)
    expect(ratingBandOf(4.6)).toBe(4.5)
    expect(ratingBandOf(4.4)).toBe(4.0)
    expect(ratingBandOf(5.0)).toBe(5.0)
    expect(ratingBandOf(0)).toBe(0)
  })
})
