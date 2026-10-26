/**
 * Dados de demonstração — para apresentar o produto com a plataforma "viva".
 *
 *   pnpm demo:seed     cria o elenco (2 criadores, 3 editores, pedidos em todas as etapas)
 *   pnpm demo:reset    remove o que já existe e cria de novo (estado limpo antes da apresentação)
 *   pnpm demo:remove   remove tudo que o seed criou
 *
 * Tudo é identificado pelo domínio `@demo.cutmakers` nos e-mails. O script NUNCA toca em
 * usuário fora desse domínio, e a remoção recusa rodar se algum pedido de demonstração
 * tiver como outra parte um usuário real (apagaria dado de verdade).
 *
 * Senha: vem de DEMO_PASSWORD ou é gerada aleatória e impressa uma única vez. Não há senha
 * fixa de propósito — contas de demonstração com senha conhecida num banco de produção
 * seriam uma porta aberta.
 */
import 'dotenv/config'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '../src/lib/prisma'
import { platformFeeOf } from '../src/lib/fees'
import { ratingBandOf } from '../src/lib/plans'
import { agreementService } from '../src/services/agreement.service'

const DEMO_DOMAIN = '@demo.cutmakers'
const SAMPLE_VIDEO = 'https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4'
const DAY = 24 * 60 * 60 * 1000
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 60 * 60 * 1000)
const ahead = (days: number) => new Date(Date.now() + days * DAY)

// ─── Remoção ───────────────────────────────────────────────────────────────────

async function remove(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_DOMAIN } },
    select: { id: true },
  })
  if (users.length === 0) return 0
  const userIds = users.map((u) => u.id)

  const orders = await prisma.order.findMany({
    where: { OR: [{ creatorId: { in: userIds } }, { editorId: { in: userIds } }] },
    select: { id: true, title: true, creatorId: true, editorId: true },
  })
  const foreign = orders.filter((o) => !userIds.includes(o.creatorId) || !userIds.includes(o.editorId))
  if (foreign.length > 0) {
    console.error('❌ Remoção abortada: há pedidos entre contas de demonstração e usuários REAIS:')
    for (const o of foreign) console.error(`   - ${o.id} · ${o.title}`)
    console.error('   Resolva/cancele esses pedidos manualmente antes de remover a demonstração.')
    process.exit(1)
  }
  const orderIds = orders.map((o) => o.id)

  const requests = await prisma.projectRequest.findMany({
    where: { creatorId: { in: userIds } },
    select: { id: true },
  })
  const requestIds = requests.map((r) => r.id)

  const profiles = await prisma.editorProfile.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  })
  const profileIds = profiles.map((p) => p.id)

  const subs = await prisma.subscription.findMany({
    where: { editorProfileId: { in: profileIds } },
    select: { id: true },
  })
  const entityIds = [...orderIds, ...subs.map((s) => s.id), ...requestIds]

  await prisma.$transaction(async (tx) => {
    const convs = await tx.conversation.findMany({
      where: { OR: [{ orderId: { in: orderIds } }, { creatorId: { in: userIds } }, { editorId: { in: userIds } }] },
      select: { id: true },
    })
    const convIds = convs.map((c) => c.id)

    await tx.message.deleteMany({ where: { OR: [{ conversationId: { in: convIds } }, { senderId: { in: userIds } }] } })
    await tx.conversation.deleteMany({ where: { id: { in: convIds } } })
    await tx.notification.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { relatedOrderId: { in: orderIds } }, { relatedRequestId: { in: requestIds } }] },
    })
    await tx.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: entityIds } }] } })
    await tx.review.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { reviewerId: { in: userIds } }, { revieweeId: { in: userIds } }] } })
    await tx.dispute.deleteMany({ where: { orderId: { in: orderIds } } })
    await tx.revision.deleteMany({ where: { orderId: { in: orderIds } } })
    await tx.delivery.deleteMany({ where: { orderId: { in: orderIds } } })
    await tx.orderFile.deleteMany({ where: { orderId: { in: orderIds } } })
    await tx.orderProposal.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { proposedBy: { in: userIds } }] } })
    await tx.orderAgreement.deleteMany({ where: { orderId: { in: orderIds } } })
    await tx.transaction.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { payerId: { in: userIds } }, { payeeId: { in: userIds } }] } })
    await tx.order.deleteMany({ where: { id: { in: orderIds } } })
    await tx.requestProposal.deleteMany({ where: { OR: [{ requestId: { in: requestIds } }, { editorId: { in: userIds } }] } })
    await tx.projectRequest.deleteMany({ where: { id: { in: requestIds } } })
    await tx.favorite.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { editorProfileId: { in: profileIds } }] } })
    await tx.subscription.deleteMany({ where: { editorProfileId: { in: profileIds } } })
    await tx.portfolioItem.deleteMany({ where: { editorProfileId: { in: profileIds } } })
    await tx.editorCategory.deleteMany({ where: { editorProfileId: { in: profileIds } } })
    await tx.editorProfile.deleteMany({ where: { id: { in: profileIds } } })
    await tx.user.deleteMany({ where: { id: { in: userIds } } })
  }, { timeout: 60_000 })

  return users.length
}

// ─── Criação ───────────────────────────────────────────────────────────────────

const CATEGORIES = ['Reels', 'YouTube', 'TikTok', 'Podcast', 'Corporativo', 'Wedding']

async function create(password: string) {
  const passwordHash = await bcrypt.hash(password, 10)

  const cat: Record<string, string> = {}
  for (const name of CATEGORIES) {
    const c = await prisma.category.upsert({ where: { name }, update: {}, create: { name } })
    cat[name] = c.id
  }

  const mkUser = (name: string, slug: string, role: 'CREATOR' | 'EDITOR', bio: string) =>
    prisma.user.create({
      data: { name, email: `${slug}${DEMO_DOMAIN}`, passwordHash, role, bio, termsAcceptedAt: ago(40) },
    })

  const [marina, rafael] = await Promise.all([
    mkUser('Marina Duarte', 'marina.duarte', 'CREATOR', 'Criadora de conteúdo de viagens e lifestyle.'),
    mkUser('Rafael Teixeira', 'rafael.teixeira', 'CREATOR', 'Apresentador de podcast sobre empreendedorismo.'),
  ])
  const [lucas, camila, bruno] = await Promise.all([
    mkUser('Lucas Andrade', 'lucas.andrade', 'EDITOR', 'Editor de vídeos para YouTube e Reels há 6 anos. Ritmo, cor e storytelling.'),
    mkUser('Camila Ferraz', 'camila.ferraz', 'EDITOR', 'Especialista em vídeos curtos verticais: TikTok, Reels e Shorts.'),
    mkUser('Bruno Medeiros', 'bruno.medeiros', 'EDITOR', 'Edição de podcasts e vídeos institucionais com acabamento limpo.'),
  ])

  const mkProfile = (userId: string, categories: string[], extra: Partial<Prisma.EditorProfileUncheckedCreateInput> = {}) =>
    prisma.editorProfile.create({
      data: {
        userId,
        categories: { create: categories.map((n) => ({ categoryId: cat[n] })) },
        ...extra,
      },
    })

  const lucasProfile = await mkProfile(lucas.id, ['YouTube', 'Reels'], {
    isPremium: true,
    premiumExpiresAt: ahead(20),
    verified: true,
  })
  const camilaProfile = await mkProfile(camila.id, ['TikTok', 'Reels'])
  const brunoProfile = await mkProfile(bruno.id, ['Podcast', 'Corporativo'])

  await prisma.subscription.create({
    data: {
      editorProfileId: lucasProfile.id,
      status: 'ACTIVE',
      amount: 39.9,
      startedAt: ago(10),
      expiresAt: ahead(20),
      externalSubscriptionId: 'demo_subscription',
    },
  })

  const portfolio: [string, string, string, number, string][] = [
    [lucasProfile.id, 'YouTube', 'Vlog de viagem em 4 dias', 450, 'Cortes dinâmicos, trilha e correção de cor.'],
    [lucasProfile.id, 'Reels', 'Pacote de Reels para lançamento', 600, 'Série de 5 Reels com legendas animadas.'],
    [camilaProfile.id, 'TikTok', 'TikTok de receita — 30s', 120, 'Ritmo rápido, legenda e efeitos sonoros.'],
    [camilaProfile.id, 'Reels', 'Reels de moda (antes/depois)', 160, 'Transições limpas e cor consistente.'],
    [brunoProfile.id, 'Podcast', 'Cortes de episódio de podcast', 300, 'Melhores momentos com legenda e logo.'],
    [brunoProfile.id, 'Corporativo', 'Vídeo institucional de 90s', 900, 'Roteiro visual, motion simples e locução.'],
  ]
  for (const [editorProfileId, category, title, basePrice, description] of portfolio) {
    await prisma.portfolioItem.create({
      data: { editorProfileId, categoryId: cat[category], title, videoUrl: SAMPLE_VIDEO, basePrice, description, createdAt: ago(30) },
    })
  }

  // ── Pedidos ───────────────────────────────────────────────────────────────────
  interface OrderSeed {
    creator: { id: string; name: string }
    editor: { id: string; name: string }
    category: string
    title: string
    description: string
    budget: number
    status: Prisma.OrderCreateInput['status']
    createdDaysAgo: number
    updatedDaysAgo?: number
    deadlineInDays?: number
  }

  async function mkOrder(o: OrderSeed) {
    const order = await prisma.order.create({
      data: {
        creatorId: o.creator.id,
        editorId: o.editor.id,
        categoryId: cat[o.category],
        title: o.title,
        description: o.description,
        budget: o.budget,
        platformFee: platformFeeOf(o.budget),
        status: o.status,
        deadline: o.deadlineInDays !== undefined ? ahead(o.deadlineInDays) : null,
        createdAt: ago(o.createdDaysAgo),
        updatedAt: ago(o.updatedDaysAgo ?? o.createdDaysAgo),
      },
    })
    return order
  }

  async function chat(orderId: string, creatorId: string, editorId: string, lines: [boolean, string][], startDaysAgo: number) {
    const conv = await prisma.conversation.create({
      data: { orderId, creatorId, editorId, createdAt: ago(startDaysAgo) },
    })
    let i = 0
    for (const [fromCreator, content] of lines) {
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: fromCreator ? creatorId : editorId,
          content,
          readAt: ago(startDaysAgo - 0.01 * i),
          createdAt: new Date(ago(startDaysAgo).getTime() + i * 37 * 60 * 1000),
        },
      })
      i++
    }
  }

  async function accept(orderId: string, both = true) {
    await agreementService.ensureAgreement(orderId)
    await prisma.orderAgreement.update({
      where: { orderId },
      data: { creatorAcceptedAt: ago(1), editorAcceptedAt: both ? ago(1) : null },
    })
  }

  async function pay(orderId: string, o: OrderSeed, status: 'HELD' | 'RELEASED') {
    const fee = platformFeeOf(o.budget)
    await prisma.transaction.create({
      data: {
        orderId,
        payerId: o.creator.id,
        payeeId: o.editor.id,
        amount: o.budget,
        platformFee: fee,
        netAmount: new Prisma.Decimal(o.budget).minus(fee),
        status,
        externalPaymentId: `demo_${orderId.slice(0, 8)}`,
        createdAt: ago(o.createdDaysAgo - 1),
      },
    })
  }

  async function review(orderId: string, reviewerId: string, revieweeId: string, rating: number, comment: string, daysAgo: number) {
    await prisma.review.create({ data: { orderId, reviewerId, revieweeId, rating, comment, createdAt: ago(daysAgo) } })
  }

  // 1-4: concluídos, com avaliação (dão reputação aos editores)
  const done: [OrderSeed, number, string][] = [
    [{ creator: marina, editor: lucas, category: 'YouTube', title: 'Vlog de viagem — Lisboa (8 min)', description: 'Vlog de 8 minutos com cortes dinâmicos, trilha e correção de cor.', budget: 450, status: 'COMPLETED', createdDaysAgo: 24, updatedDaysAgo: 17 }, 5, 'Ficou exatamente como eu imaginava. Entrega antes do prazo e muito atencioso.'],
    [{ creator: rafael, editor: lucas, category: 'Reels', title: 'Reels de lançamento do curso', description: 'Cinco Reels com legenda animada para o lançamento.', budget: 600, status: 'COMPLETED', createdDaysAgo: 20, updatedDaysAgo: 12 }, 5, 'Profissional demais. Já agendei o próximo pedido.'],
    [{ creator: marina, editor: camila, category: 'TikTok', title: 'TikTok de receita — série 3', description: 'Três vídeos curtos de receita, 30 segundos cada.', budget: 280, status: 'COMPLETED', createdDaysAgo: 18, updatedDaysAgo: 11 }, 5, 'Rápida, criativa e entendeu o tom do meu perfil de primeira.'],
    [{ creator: rafael, editor: bruno, category: 'Podcast', title: 'Cortes do episódio 41', description: 'Cinco cortes de até 60s com legenda e logo.', budget: 300, status: 'COMPLETED', createdDaysAgo: 16, updatedDaysAgo: 9 }, 4, 'Bom trabalho. Precisei de um ajuste na legenda, que resolveu rápido.'],
  ]
  const ratings: Record<string, number[]> = {}
  for (const [seed, rating, comment] of done) {
    const order = await mkOrder(seed)
    await accept(order.id)
    await pay(order.id, seed, 'RELEASED')
    await prisma.delivery.create({
      data: { orderId: order.id, videoUrl: SAMPLE_VIDEO, message: 'Segue a entrega final. Qualquer ajuste é só chamar!', version: 1, createdAt: ago((seed.updatedDaysAgo ?? 10) + 1) },
    })
    await review(order.id, seed.creator.id, seed.editor.id, rating, comment, seed.updatedDaysAgo ?? 8)
    ;(ratings[seed.editor.id] ??= []).push(rating)
  }
  for (const [profile, userId] of [[lucasProfile, lucas.id], [camilaProfile, camila.id], [brunoProfile, bruno.id]] as const) {
    const list = ratings[userId] ?? []
    const avg = list.reduce((a, b) => a + b, 0) / (list.length || 1)
    await prisma.editorProfile.update({
      where: { id: profile.id },
      data: { avgRating: avg, ratingBand: ratingBandOf(avg), totalJobs: list.length },
    })
  }

  // 5: em andamento (pago, editor trabalhando) — demonstra chat, arquivos e entrega
  const inProgress: OrderSeed = {
    creator: marina, editor: camila, category: 'TikTok',
    title: '3 TikToks da campanha de verão', description: 'Três vídeos verticais de 20 a 30s com material bruto de praia. Tom leve, legendas grandes e trilha animada.',
    budget: 520, status: 'IN_PROGRESS', createdDaysAgo: 3, updatedDaysAgo: 1, deadlineInDays: 4,
  }
  const o5 = await mkOrder(inProgress)
  await accept(o5.id)
  await pay(o5.id, inProgress, 'HELD')
  await prisma.orderFile.create({ data: { orderId: o5.id, fileUrl: SAMPLE_VIDEO, fileName: 'bruto-praia-01.mp4', fileType: 'video/mp4', uploadedAt: ago(2) } })
  await prisma.orderFile.create({ data: { orderId: o5.id, fileUrl: SAMPLE_VIDEO, fileName: 'bruto-praia-02.mp4', fileType: 'video/mp4', uploadedAt: ago(2) } })
  await chat(o5.id, marina.id, camila.id, [
    [true, 'Oi Camila! Enviei os dois arquivos brutos. Quero algo bem leve, com legenda grande.'],
    [false, 'Oi Marina! Recebi tudo. Vou começar pelo primeiro vídeo e te mostro o ritmo até amanhã.'],
    [true, 'Perfeito. Pode usar a trilha animada que combinamos.'],
    [false, 'Fechado! Já separei duas opções de trilha.'],
  ], 2.5)

  // 6: entregue — o criador pode aprovar (libera o pagamento) ou pedir revisão
  const delivered: OrderSeed = {
    creator: rafael, editor: lucas, category: 'Reels',
    title: 'Teaser do podcast — episódio 42', description: 'Teaser de 45s com os melhores momentos, legenda e vinheta.',
    budget: 380, status: 'DELIVERED', createdDaysAgo: 6, updatedDaysAgo: 0.3,
  }
  const o6 = await mkOrder(delivered)
  await accept(o6.id)
  await pay(o6.id, delivered, 'HELD')
  await prisma.delivery.create({
    data: { orderId: o6.id, videoUrl: SAMPLE_VIDEO, message: 'Teaser pronto! Usei a vinheta nova e destaquei a frase de abertura.', version: 1, createdAt: ago(0.3) },
  })
  await chat(o6.id, rafael.id, lucas.id, [
    [true, 'Lucas, queria que o teaser abrisse com a frase sobre o primeiro cliente.'],
    [false, 'Anotado! Entrego até amanhã com essa abertura.'],
    [false, 'Entreguei! Dá uma olhada e me diz se quer algum ajuste.'],
  ], 2)

  // 7: aguardando pagamento — contrato aceito; o criador paga na hora (demonstra o checkout)
  const awaiting: OrderSeed = {
    creator: marina, editor: bruno, category: 'Corporativo',
    title: 'Institucional de 90s para o meu estúdio', description: 'Vídeo institucional de 90 segundos apresentando o estúdio, com locução e trilha.',
    budget: 900, status: 'AWAITING_PAYMENT', createdDaysAgo: 2, updatedDaysAgo: 0.5, deadlineInDays: 10,
  }
  const o7 = await mkOrder(awaiting)
  await accept(o7.id)
  await chat(o7.id, marina.id, bruno.id, [
    [true, 'Oi Bruno! Gostei muito do seu institucional no portfólio.'],
    [false, 'Obrigado, Marina! Posso fechar em R$ 900 com locução inclusa.'],
    [true, 'Combinado! Aceitei o contrato, é só confirmar o pagamento.'],
  ], 1.5)

  // 8: negociando — editor fez uma contraproposta pendente
  const negotiating: OrderSeed = {
    creator: rafael, editor: camila, category: 'Reels',
    title: 'Reels semanais — pacote de 4', description: 'Quatro Reels por mês a partir dos cortes do podcast.',
    budget: 700, status: 'NEGOTIATING', createdDaysAgo: 1, updatedDaysAgo: 0.2,
  }
  const o8 = await mkOrder(negotiating)
  await prisma.orderProposal.create({
    data: { orderId: o8.id, proposedBy: camila.id, amount: 640, message: 'Posso fazer o pacote por R$ 640 se enviarmos os cortes até segunda.', status: 'PENDING', createdAt: ago(0.2) },
  })

  // 9: pedido novo, ainda sem resposta do editor
  const fresh: OrderSeed = {
    creator: marina, editor: lucas, category: 'YouTube',
    title: 'Edição do vlog semanal #12', description: 'Vlog de 10 minutos, estilo parecido com o de Lisboa.',
    budget: 480, status: 'PENDING', createdDaysAgo: 0.1, deadlineInDays: 7,
  }
  await mkOrder(fresh)

  // ── Solicitação aberta (marketplace invertido) com propostas ───────────────────
  const request = await prisma.projectRequest.create({
    data: {
      creatorId: marina.id,
      categoryId: cat['YouTube'],
      title: 'Preciso de editor fixo para vlogs semanais',
      description: 'Procuro um editor para vlogs de 8 a 12 minutos toda semana. Material bruto pelo Drive, prazo de 3 dias por vídeo.',
      budgetMin: 400,
      budgetMax: 700,
      deadline: ahead(14),
      referenceLinks: [SAMPLE_VIDEO],
      createdAt: ago(1),
    },
  })
  await prisma.requestProposal.createMany({
    data: [
      { requestId: request.id, editorId: lucas.id, amount: 520, deliveryDays: 3, message: 'Já editei vlogs seus e conheço o estilo. Fecho por R$ 520 por vídeo, com prioridade na fila.', createdAt: ago(0.6) },
      { requestId: request.id, editorId: bruno.id, amount: 450, deliveryDays: 4, message: 'Tenho experiência com conteúdo recorrente. Faço R$ 450 por vídeo com 2 revisões inclusas.', createdAt: ago(0.4) },
    ],
  })

  // ── Notificações (sino não nasce vazio) ────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: rafael.id, type: 'DELIVERY_RECEIVED', title: 'Entrega recebida', body: 'Lucas Andrade entregou "Teaser do podcast — episódio 42".', relatedOrderId: o6.id, createdAt: ago(0.3) },
      { userId: camila.id, type: 'PROPOSAL_RECEIVED', title: 'Proposta enviada', body: 'Sua contraproposta de R$ 640,00 aguarda resposta de Rafael.', relatedOrderId: o8.id, createdAt: ago(0.2) },
      { userId: bruno.id, type: 'CONTRACT_ACCEPTED', title: 'Contrato aceito', body: 'Marina aceitou o contrato de "Institucional de 90s para o meu estúdio".', relatedOrderId: o7.id, createdAt: ago(0.5) },
      { userId: marina.id, type: 'REQUEST_PROPOSAL_RECEIVED', title: 'Nova proposta na sua solicitação', body: 'Lucas Andrade e Bruno Medeiros enviaram propostas.', relatedRequestId: request.id, createdAt: ago(0.4) },
    ],
  })
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const cmd = process.argv[2]

  if (cmd === 'remove') {
    const n = await remove()
    console.log(n ? `✓ Demonstração removida (${n} contas e todos os dados ligados a elas).` : 'Nada para remover.')
    return
  }

  if (cmd === 'reset') {
    const n = await remove()
    if (n) console.log(`✓ Demonstração anterior removida (${n} contas).`)
  } else if (cmd === 'seed') {
    const exists = await prisma.user.count({ where: { email: { endsWith: DEMO_DOMAIN } } })
    if (exists > 0) {
      console.error('❌ Já existem contas de demonstração. Use "pnpm demo:reset" para recriar do zero.')
      process.exit(1)
    }
  } else {
    console.error('Uso: tsx scripts/seed-demo.ts <seed|reset|remove>')
    process.exit(1)
  }

  const generated = !process.env.DEMO_PASSWORD
  const password = process.env.DEMO_PASSWORD ?? crypto.randomBytes(9).toString('base64url')
  if (password.length < 8) {
    console.error('❌ DEMO_PASSWORD precisa ter ao menos 8 caracteres.')
    process.exit(1)
  }

  await create(password)

  console.log('\n✓ Demonstração criada.\n')
  console.log('  Criadores:  marina.duarte' + DEMO_DOMAIN + '   |   rafael.teixeira' + DEMO_DOMAIN)
  console.log('  Editores:   lucas.andrade' + DEMO_DOMAIN + ' (Premium)   |   camila.ferraz' + DEMO_DOMAIN + '   |   bruno.medeiros' + DEMO_DOMAIN)
  console.log(`  Senha (todas): ${password}${generated ? '   <- gerada agora; anote, não será mostrada de novo' : ''}\n`)
}

main()
  .catch((err) => {
    console.error('❌ Falha:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
