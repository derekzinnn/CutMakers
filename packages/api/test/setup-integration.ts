import { PrismaClient } from '@prisma/client'
import { beforeAll, afterAll } from 'vitest'

/**
 * Harness dos testes de integração.
 *
 * Os services importam o singleton de `src/lib/prisma.ts`, que resolve assim:
 *   export const prisma = globalForPrisma.prisma ?? new PrismaClient(...)
 *
 * Esse cache em globalThis é o ponto de injeção: preenchendo-o AQUI (setupFiles
 * roda antes dos módulos de teste), todo service passa a falar com o schema de
 * teste sem que uma linha de código de produção mude.
 */
const url = process.env.TEST_DATABASE_URL

if (!url) {
  throw new Error(
    'TEST_DATABASE_URL não definida. Veja packages/api/.env.example — ela aponta para o ' +
      'MESMO Supabase, num schema isolado (?schema=cutmakers_test).',
  )
}

// GUARDA DE SEGURANÇA, não negociável: os testes criam e apagam dados. Se isso
// apontar para `public`, um deleteMany de limpeza apaga dados reais de produção.
// Falhar aqui é infinitamente melhor que descobrir depois.
if (!/[?&]schema=cutmakers_test(&|$)/.test(url)) {
  throw new Error(
    'TEST_DATABASE_URL precisa terminar em ?schema=cutmakers_test. ' +
      'Recebido um alvo sem esse schema — recusando rodar para não tocar em dados reais.',
  )
}
if (/pgbouncer=true/.test(url) || /:6543\//.test(url)) {
  throw new Error(
    'Use a conexão direta (porta 5432) nos testes. O pgBouncer opera em transaction ' +
      'mode e quebra as transações interativas que os claims otimistas usam.',
  )
}

export const testPrisma = new PrismaClient({
  datasources: { db: { url } },
  log: ['error'],
})

// Preenche o cache ANTES de qualquer import de service
;(globalThis as unknown as { prisma: PrismaClient }).prisma = testPrisma

/** Apaga tudo respeitando as foreign keys (filhos antes dos pais). */
export async function limparBanco() {
  await testPrisma.auditLog.deleteMany()
  await testPrisma.notification.deleteMany()
  await testPrisma.message.deleteMany()
  await testPrisma.conversation.deleteMany()
  await testPrisma.revision.deleteMany()
  await testPrisma.delivery.deleteMany()
  await testPrisma.review.deleteMany()
  await testPrisma.dispute.deleteMany()
  await testPrisma.orderAgreement.deleteMany()
  await testPrisma.transaction.deleteMany()
  await testPrisma.orderProposal.deleteMany()
  await testPrisma.orderFile.deleteMany()
  await testPrisma.order.deleteMany()
  await testPrisma.requestProposal.deleteMany()
  await testPrisma.projectRequest.deleteMany()
  await testPrisma.subscription.deleteMany()
  await testPrisma.portfolioItem.deleteMany()
  await testPrisma.editorCategory.deleteMany()
  await testPrisma.editorProfile.deleteMany()
  await testPrisma.user.deleteMany()
  await testPrisma.category.deleteMany()
}

beforeAll(async () => {
  await limparBanco()
})

afterAll(async () => {
  await limparBanco()
  await testPrisma.$disconnect()
})
