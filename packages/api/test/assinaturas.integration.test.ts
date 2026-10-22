import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { testPrisma, limparBanco } from './setup-integration'
import { criarEditor } from './fixtures'
import { subscriptionService, PREMIUM_MONTHLY_PRICE } from '../src/services/subscription.service'

/**
 * Assinatura Premium do editor. Em dev mode (sem ABACATEPAY_API_KEY) a cobrança
 * se auto-confirma — o mesmo modo da demonstração.
 */
beforeAll(() => {
  delete process.env.ABACATEPAY_API_KEY
})
beforeEach(async () => {
  await limparBanco()
})

describe('assinatura premium', () => {
  it('assinar em dev mode ativa na hora: isPremium true + expiresAt +30d', async () => {
    const { user, profile } = await criarEditor()

    const result = await subscriptionService.createSubscription(user.id)
    expect(result.devConfirmed).toBe(true)

    const prof = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(prof.isPremium).toBe(true)
    expect(prof.premiumExpiresAt).not.toBeNull()

    const sub = await testPrisma.subscription.findFirstOrThrow({ where: { editorProfileId: profile.id } })
    expect(sub.status).toBe('ACTIVE')
    expect(Number(sub.amount)).toBe(PREMIUM_MONTHLY_PRICE)
  })

  it('getMySubscription reflete o estado premium', async () => {
    const { user } = await criarEditor()
    await subscriptionService.createSubscription(user.id)

    const me = await subscriptionService.getMySubscription(user.id)
    expect(me.isPremium).toBe(true)
    expect(me.price).toBe(PREMIUM_MONTHLY_PRICE)
    expect(me.subscription?.status).toBe('ACTIVE')
  })

  it('bloqueia 2a assinatura fora da janela de renovação', async () => {
    const { user } = await criarEditor()
    await subscriptionService.createSubscription(user.id)
    // ACTIVE com 30 dias restantes → nova assinatura é bloqueada
    await expect(subscriptionService.createSubscription(user.id)).rejects.toMatchObject({ status: 400 })
  })

  it('não acumula cobranças PENDING: a 2a tentativa (antes de confirmar) é barrada', async () => {
    // Simula estado onde a confirmação dev não rodou: cria PENDING manual recente
    const { user, profile } = await criarEditor()
    await testPrisma.subscription.create({
      data: { editorProfileId: profile.id, status: 'PENDING', amount: PREMIUM_MONTHLY_PRICE },
    })
    await expect(subscriptionService.createSubscription(user.id)).rejects.toThrow(/cobran[çc]a.*aberto/i)
  })

  it('checkAndExpireSubscriptions: vencida vira EXPIRED e isPremium false', async () => {
    const { user, profile } = await criarEditor()
    await subscriptionService.createSubscription(user.id)

    // Força vencimento no passado
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await testPrisma.subscription.updateMany({
      where: { editorProfileId: profile.id, status: 'ACTIVE' },
      data: { expiresAt: ontem },
    })

    await subscriptionService.checkAndExpireSubscriptions()

    const prof = await testPrisma.editorProfile.findUniqueOrThrow({ where: { id: profile.id } })
    expect(prof.isPremium).toBe(false)
    const sub = await testPrisma.subscription.findFirstOrThrow({ where: { editorProfileId: profile.id } })
    expect(sub.status).toBe('EXPIRED')
  })

  it('editor sem perfil ainda não premium', async () => {
    const semPerfil = await testPrisma.user.create({
      data: { name: 'Novo', email: `novo-${Date.now()}@teste.local`, passwordHash: 'x', role: 'EDITOR' },
    })
    const me = await subscriptionService.getMySubscription(semPerfil.id)
    expect(me.isPremium).toBe(false)
    expect(me.subscription).toBeNull()
  })
})
