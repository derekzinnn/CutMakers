// Trace E2E do marketplace invertido (Fase 12) contra a API local.
// Pré-requisitos: `db:push` aplicado, API rodando (pnpm api), Abacatepay em dev mode
// (sem ABACATEPAY_API_KEY → pagamento auto-confirma).
//
//   pnpm --filter @cutmakers/api trace:requests
//
// Cria usuários/dados de teste com prefixo "trace_" no banco configurado no .env.
import 'dotenv/config'
import prismaPkg from '@prisma/client'

const { PrismaClient } = prismaPkg
const prisma = new PrismaClient()
const API = process.env.TRACE_API_URL ?? 'http://localhost:3333/api'
const ts = Date.now()
let failures = 0

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function ok(method, path, opts) {
  const r = await call(method, path, opts)
  if (r.status >= 400) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(r.json)}`)
  return r.json
}

function check(label, cond, detail = '') {
  console.log(`${cond ? '  ✅' : '  ❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!cond) failures++
}

async function expectStatus(label, expected, method, path, opts) {
  const r = await call(method, path, opts)
  check(label, r.status === expected, `HTTP ${r.status}${r.json?.message ? ` "${r.json.message}"` : ''}`)
}

async function register(name, role) {
  const email = `trace_${name.toLowerCase()}_${ts}@cutmakers.dev`
  const res = await ok('POST', '/auth/register', {
    body: { name: `Trace ${name}`, email, password: 'senha12345', role, acceptTerms: true },
  })
  return { ...res, email }
}

const inDays = (d) => new Date(Date.now() + d * 86_400_000).toISOString()

try {
  console.log('\n[1] Usuários')
  const creator = await register('Creator', 'CREATOR')
  const editorA = await register('EditorA', 'EDITOR')
  const editorB = await register('EditorB', 'EDITOR')
  // Usuário BOTH não pode ser criado pela API pública → promove via Prisma e re-loga
  const both = await register('Both', 'CREATOR')
  await prisma.user.update({ where: { id: both.user.id }, data: { role: 'BOTH' } })
  const bothLogin = await ok('POST', '/auth/login', { body: { email: both.email, password: 'senha12345' } })
  console.log('  creator, 2 editores e 1 usuário BOTH prontos')

  const { categories } = await ok('GET', '/categories')
  const categoryId = categories[0].id

  console.log('\n[2] Creator publica a solicitação')
  const { request } = await ok('POST', '/requests', {
    token: creator.token,
    body: {
      categoryId,
      title: `Trace — 3 reels de lançamento ${ts}`,
      description: 'Preciso de 3 reels verticais de 30s com legenda dinâmica e trilha.',
      budgetMin: 100,
      budgetMax: 300,
      deadline: inDays(10),
      revisionsIncluded: 3,
      referenceLinks: ['https://example.com/ref'],
    },
  })
  check('solicitação criada OPEN', request.status === 'OPEN', request.id)

  console.log('\n[3] Quadro de oportunidades (editor)')
  const board = await ok('GET', `/requests?category=${categoryId}`, { token: editorA.token })
  const item = board.requests.find((r) => r.id === request.id)
  check('aparece no quadro do editor', !!item)
  check('lista não expõe descrição completa nem links', item && !('description' in item) && !('referenceLinks' in item))
  const detailForEditor = await ok('GET', `/requests/${request.id}`, { token: editorA.token })
  check('detalhe do editor tem descrição + links', detailForEditor.request.referenceLinks.length === 1)
  check('detalhe do editor NÃO lista propostas alheias', !('proposals' in detailForEditor.request))

  console.log('\n[4] Dois editores propõem')
  await ok('POST', `/requests/${request.id}/proposals`, {
    token: editorA.token, body: { amount: 250, deliveryDays: 5, message: 'Faço com motion e legenda animada.' },
  })
  await ok('POST', `/requests/${request.id}/proposals`, {
    token: editorB.token, body: { amount: 180, deliveryDays: 7, message: 'Entrego os 3 reels com 2 opções de capa.' },
  })
  check('2 propostas enviadas', true)

  console.log('\n[5] Edge cases de proposta')
  await expectStatus('proposta duplicada → 409', 409, 'POST', `/requests/${request.id}/proposals`, {
    token: editorA.token, body: { amount: 200, deliveryDays: 5, message: 'Tentando de novo a mesma proposta.' },
  })
  await expectStatus('creator puro não pode propor → 403', 403, 'POST', `/requests/${request.id}/proposals`, {
    token: creator.token, body: { amount: 200, deliveryDays: 5, message: 'Sou creator, não posso propor.' },
  })
  await expectStatus('amount ≤ 0 → 400', 400, 'POST', `/requests/${request.id}/proposals`, {
    token: bothLogin.token, body: { amount: 0, deliveryDays: 5, message: 'Valor inválido de propósito.' },
  })
  const { request: ownReq } = await ok('POST', '/requests', {
    token: bothLogin.token,
    body: { categoryId, title: `Trace BOTH ${ts}`, description: 'Solicitação do usuário BOTH para teste.' },
  })
  await expectStatus('BOTH propondo na própria solicitação → 403', 403, 'POST', `/requests/${ownReq.id}/proposals`, {
    token: bothLogin.token, body: { amount: 150, deliveryDays: 3, message: 'Proposta na minha própria solicitação.' },
  })
  const bothBoard = await ok('GET', '/requests', { token: bothLogin.token })
  check('BOTH não vê a própria solicitação no quadro', !bothBoard.requests.some((r) => r.id === ownReq.id))

  console.log('\n[6] Creator vê propostas ordenadas por preço')
  const detail = await ok('GET', `/requests/${request.id}?sort=amount`, { token: creator.token })
  const amounts = detail.request.proposals.map((p) => p.amount)
  check('ordenadas pelo menor preço', amounts[0] === 180 && amounts[1] === 250, JSON.stringify(amounts))
  check('editor tem dados públicos (rating/jobs/premium)', 'avgRating' in detail.request.proposals[0].editor)

  console.log('\n[7] Editar solicitação com propostas (ainda OPEN)')
  const edit = await call('PATCH', `/requests/${request.id}`, {
    token: creator.token, body: { description: 'Preciso de 3 reels verticais de 30s com legenda dinâmica, trilha e capa.' },
  })
  check('edição permitida enquanto OPEN (comportamento atual da spec)', edit.status === 200, `HTTP ${edit.status}`)

  console.log('\n[8] Creator aceita a proposta mais barata (Editor B)')
  const cheapest = detail.request.proposals[0]
  const accepted = await ok('POST', `/requests/${request.id}/proposals/${cheapest.id}/accept`, { token: creator.token })
  check('retornou orderId', !!accepted.orderId, accepted.orderId)

  const { order } = await ok('GET', `/orders/${accepted.orderId}`, { token: creator.token })
  check('Order em AWAITING_PAYMENT', order.status === 'AWAITING_PAYMENT', order.status)
  check('budget = 180 / platformFee = 18', order.budget === 180 && order.platformFee === 18, `${order.budget}/${order.platformFee}`)
  check('editor do pedido = Editor B', order.editor.id === editorB.user.id)
  check('requestId vinculado', order.requestId === request.id)
  check('revisionsIncluded herdado (3)', order.revisionsIncluded === 3)
  check('contrato gerado no aceite', !!order.agreement && order.agreement.content.includes('3 rodadas'))
  check('OrderProposal ACCEPTED no histórico', order.proposals.some((p) => p.status === 'ACCEPTED' && p.amount === 180))

  console.log('\n[9] Efeitos colaterais do aceite')
  const after = await ok('GET', `/requests/${request.id}`, { token: creator.token })
  check('solicitação FILLED', after.request.status === 'FILLED')
  await expectStatus('aceitar de novo em solicitação FILLED → 400', 400, 'POST',
    `/requests/${request.id}/proposals/${detail.request.proposals[1].id}/accept`, { token: creator.token })
  await expectStatus('propor em solicitação FILLED → 400', 400, 'POST', `/requests/${request.id}/proposals`, {
    token: bothLogin.token, body: { amount: 120, deliveryDays: 4, message: 'Tentando propor depois de fechada.' },
  })
  const minesA = await ok('GET', '/requests/proposals/mine', { token: editorA.token })
  check('Editor A vê a própria proposta como REJECTED', minesA.proposals.find((p) => p.request.id === request.id)?.status === 'REJECTED')
  const notifA = await ok('GET', '/notifications', { token: editorA.token })
  check('Editor A notificado ("fechado com outro editor")',
    notifA.notifications.some((n) => n.type === 'REQUEST_PROPOSAL_REJECTED' && n.body.includes('outro editor')))
  const notifB = await ok('GET', '/notifications', { token: editorB.token })
  check('Editor B notificado com link pro pedido',
    notifB.notifications.some((n) => n.type === 'REQUEST_PROPOSAL_ACCEPTED' && n.relatedOrderId === accepted.orderId))

  console.log('\n[10] Pipeline existente segue intacto (contrato → pagamento → entrega → aprovação)')
  await expectStatus('pagamento bloqueado sem contrato aceito → 400', 400, 'POST', `/orders/${order.id}/payment`, { token: creator.token })
  await ok('POST', `/orders/${order.id}/agreement/accept`, { token: creator.token })
  await ok('POST', `/orders/${order.id}/agreement/accept`, { token: editorB.token })
  await ok('POST', `/orders/${order.id}/payment`, { token: creator.token })
  let cur = (await ok('GET', `/orders/${order.id}`, { token: creator.token })).order
  check('pago → IN_PROGRESS / escrow HELD', cur.status === 'IN_PROGRESS' && cur.transaction?.status === 'HELD', `${cur.status}/${cur.transaction?.status}`)
  await ok('POST', `/orders/${order.id}/deliveries`, {
    token: editorB.token, body: { videoUrl: 'https://example.com/entrega.mp4', message: 'Entrega do trace' },
  })
  await ok('PATCH', `/orders/${order.id}/status`, { token: creator.token, body: { status: 'COMPLETED' } })
  cur = (await ok('GET', `/orders/${order.id}`, { token: creator.token })).order
  check('aprovado → COMPLETED / RELEASED', cur.status === 'COMPLETED' && cur.transaction?.status === 'RELEASED', `${cur.status}/${cur.transaction?.status}`)

  console.log('\n[11] Cancelamento com propostas pendentes')
  const { request: r3 } = await ok('POST', '/requests', {
    token: creator.token,
    body: { categoryId, title: `Trace cancelamento ${ts}`, description: 'Solicitação que será cancelada no teste.' },
  })
  await ok('POST', `/requests/${r3.id}/proposals`, {
    token: editorA.token, body: { amount: 90, deliveryDays: 2, message: 'Proposta que será encerrada.' },
  })
  const cancel = await ok('POST', `/requests/${r3.id}/cancel`, { token: creator.token })
  check('cancelada com 1 proposta encerrada', cancel.status === 'CANCELLED' && cancel.rejectedProposals === 1)
  const minesA2 = await ok('GET', '/requests/proposals/mine', { token: editorA.token })
  check('proposta do Editor A virou REJECTED', minesA2.proposals.find((p) => p.request.id === r3.id)?.status === 'REJECTED')
  const notifA2 = await ok('GET', '/notifications', { token: editorA.token })
  check('Editor A notificado do cancelamento', notifA2.notifications.some((n) => n.title === 'Solicitação cancelada'))

  console.log('\n[12] Auditoria')
  const admin = await ok('POST', '/auth/login', { body: { email: 'cutmakers@admin.com', password: 'cutmakers@123' } })
  const audit = await ok('GET', '/admin/audit-log?action=REQUEST_PROPOSAL_ACCEPTED', { token: admin.token })
  const entry = audit.logs.find((l) => l.metadata?.orderId === accepted.orderId)
  check('REQUEST_PROPOSAL_ACCEPTED com { amount, platformFee, requestId, orderId }',
    !!entry && entry.metadata.amount === 180 && entry.metadata.platformFee === 18 && entry.metadata.requestId === request.id)

  console.log(failures === 0 ? '\n✅ TRACE COMPLETO — tudo conforme esperado\n' : `\n❌ ${failures} verificação(ões) falharam\n`)
} catch (err) {
  failures++
  console.error('\n💥 Trace interrompido:', err.message)
} finally {
  await prisma.$disconnect()
  process.exitCode = failures === 0 ? 0 : 1
}
