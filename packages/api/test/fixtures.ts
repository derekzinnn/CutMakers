import { OrderStatus } from '@prisma/client'
import { testPrisma } from './setup-integration'

let seq = 0
const uniq = () => `${Date.now()}-${++seq}`

export async function criarCategoria(nome = 'Reels') {
  return testPrisma.category.create({ data: { name: `${nome}-${uniq()}` } })
}

export async function criarCreator() {
  return testPrisma.user.create({
    data: {
      name: 'Creator Teste',
      email: `creator-${uniq()}@teste.local`,
      passwordHash: 'nao-usado-nestes-testes',
      role: 'CREATOR',
    },
  })
}

export async function criarEditor(opts: { banned?: boolean } = {}) {
  const user = await testPrisma.user.create({
    data: {
      name: 'Editor Teste',
      email: `editor-${uniq()}@teste.local`,
      passwordHash: 'nao-usado-nestes-testes',
      role: 'EDITOR',
      banned: opts.banned ?? false,
    },
  })
  const profile = await testPrisma.editorProfile.create({ data: { userId: user.id } })
  return { user, profile }
}

/** Monta um pedido completo pronto para o estágio pedido. */
export async function criarPedido(opts: {
  status?: OrderStatus
  budget?: number
  revisionsIncluded?: number
  comArquivos?: number
} = {}) {
  const categoria = await criarCategoria()
  const creator = await criarCreator()
  const { user: editor, profile } = await criarEditor()

  const budget = opts.budget ?? 200
  const order = await testPrisma.order.create({
    data: {
      creatorId: creator.id,
      editorId: editor.id,
      categoryId: categoria.id,
      title: 'Pedido de teste',
      description: 'Briefing de teste',
      budget,
      platformFee: budget * 0.1,
      status: opts.status ?? 'IN_PROGRESS',
      revisionsIncluded: opts.revisionsIncluded ?? 2,
      files: opts.comArquivos
        ? {
            create: Array.from({ length: opts.comArquivos }, (_, i) => ({
              fileUrl: `https://res.cloudinary.com/demo/video/upload/bruto-${i}.mp4`,
              fileName: `material-bruto-${i}.mp4`,
              fileType: 'video/mp4',
            })),
          }
        : undefined,
    },
  })

  return { order, creator, editor, editorProfile: profile, categoria }
}

/** Transação em escrow (HELD) para o pedido — necessária para release/refund. */
export async function criarTransacaoHeld(orderId: string, payerId: string, payeeId: string, amount = 200) {
  return testPrisma.transaction.create({
    data: {
      orderId,
      payerId,
      payeeId,
      amount,
      platformFee: amount * 0.1,
      netAmount: amount * 0.9,
      status: 'HELD',
      externalPaymentId: `ch_teste_${uniq()}`,
    },
  })
}

/** Transação PENDING — ponto de partida do webhook billing.paid. */
export async function criarTransacaoPendente(
  orderId: string, payerId: string, payeeId: string, externalPaymentId: string, amount = 200,
) {
  return testPrisma.transaction.create({
    data: {
      orderId, payerId, payeeId, amount,
      platformFee: amount * 0.1,
      netAmount: amount * 0.9,
      status: 'PENDING',
      externalPaymentId,
    },
  })
}
