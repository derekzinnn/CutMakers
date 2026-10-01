# CutMakers — Contexto do projeto

> Este arquivo é lido automaticamente pelo Claude Code ao abrir o repositório.
> Mantém o assistente alinhado com o que já foi decidido e construído.

---

## 🎯 O que é o CutMakers

Marketplace que conecta **criadores de conteúdo** (influenciadores) a **editores freelancers** de vídeo. Funciona como um Fiverr focado exclusivamente em edição de vídeo, com escrow de pagamento e sistema de portfólio.

**Monetização:** taxa sobre cada trabalho concluído + assinatura premium para editores.

**Briefing completo:** Ver `BRIEFING.md` na raiz do repositório.

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Monorepo | pnpm workspaces |
| Backend | Node.js + Express + TypeScript + Prisma |
| Database | Supabase (PostgreSQL) — conectado via Prisma com `pgbouncer=true` |
| Frontend Web | React 18 + Vite + TypeScript + shadcn/ui + Tailwind v3 |
| Mobile (futuro) | React Native |
| Upload | Cloudinary (signed direct upload do frontend, sem proxy) |
| Pagamentos (futuro) | Abacatepay (escrow) |
| Ícones | Tabler Icons (outline only) |
| Fontes | Syne (headings 700/800) + DM Sans (body 300/400/500) |

---

## 📁 Estrutura

```
cutmakers/
├── packages/
│   ├── api/                  Backend Express
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── lib/          prisma, cloudinary, errors
│   │       ├── middlewares/  auth, role, error
│   │       ├── services/     auth, editor, portfolio, upload
│   │       ├── controllers/
│   │       ├── routes/
│   │       └── app.ts, index.ts
│   └── web/                  Frontend React
│       └── src/
│           ├── components/
│           │   ├── layout/   DashboardShell (navLabel, badgeLabel, actions)
│           │   └── ui/       Button, Input, Modal, CMLogo (CMLogo + CMLockup)
│           ├── hooks/        use-auth, use-categories, use-editor-me
│           ├── lib/          api (axios), upload (cloudinary), utils
│           └── pages/
│               ├── admin/    AdminPage
│               ├── editor/   EditorDashboard + components
│               ├── creator/  CreatorDashboard  ← EditorCard redesenhado (Fase 3.5)
│               ├── orders/   OrderDetailPage
│               ├── LandingPage (public /)
│               ├── LoginPage, RegisterPage
│               ├── EditorPublicProfile  ← redesenhado (Fase 3.5)
│               └── App.tsx
└── CLAUDE.md (este arquivo)
```

---

## 🎨 Design system (SEGUIR RIGOROSAMENTE)

### Cores
```
--navy:       #0D1B2A    fundo principal
--navy-mid:   #162436    sidebars, painéis
--navy-light: #1E3045    cards elevados, hover
--orange:     #F4631E    CTAs, highlights
--orange-hover: #E0551A
```

Texto:
- branco puro: títulos importantes
- `rgba(255,255,255,0.8)` body principal
- `rgba(255,255,255,0.4)` secundário
- bordas: `rgba(255,255,255,0.08)`

### Componentes
- Border-radius: 8px (inputs/buttons), 12px (cards), 16px (modais)
- Sem gradientes decorativos
- Botão primário: fundo `#F4631E`, fonte Syne semibold
- Inputs: fundo `rgba(255,255,255,0.05)`, focus border `rgba(244,99,30,0.5)`

### Layouts de auth (login/cadastro)
- Split 40/60: esquerda institucional (`#162436`), direita formulário (`#0D1B2A`)
- Círculos SVG decorativos sutis no painel esquerdo

---

## 🔐 Regras importantes do briefing

1. **JWT próprio, não Supabase Auth** — controle total sobre roles
2. **Cloudinary, não Supabase Storage** — todos os uploads
3. **Conexão DB via pooler** `?pgbouncer=true` na DATABASE_URL (porta 6543) + DIRECT_URL (5432) para migrations
4. **NUNCA exibir seletor de role na tela de login** — backend identifica o role pelas credenciais
5. **Admins só via seed**, nunca por endpoint público
6. **Role `BOTH`** no login mostra modal de escolha de painel (Creator ou Editor)
7. **Role `ADMIN`** redireciona para `/admin` — painel com sidebar tem switcher Admin/Creator/Editor

---

## 🔌 Endpoints da API

### Auth (`/api/auth`)
- `POST /register` — { name, email, password, role: 'CREATOR'|'EDITOR' }
- `POST /login` — retorna { token, refreshToken, user }
- `POST /refresh` — troca refreshToken por novo token
- `GET /me` — usuário logado

### Editor (`/api/editors`)
- `GET /` — lista pública com filtros (`?category=`, `?search=`, `?premium=true`, `?page=`, `?limit=`)
- `GET /me` — perfil do editor logado (EDITOR/BOTH)
- `PATCH /me` — atualiza próprio perfil (EDITOR/BOTH)
- `GET /:id` — perfil público completo

### Portfolio (`/api/portfolio`)
- `GET /` — lista (filtros: `?editor=userId`, `?category=catId`)
- `GET /:id`
- `POST /` — cria (EDITOR/BOTH)
- `PATCH /:id` — atualiza (dono ou ADMIN)
- `DELETE /:id` — remove (dono ou ADMIN, bloqueado se tem Orders vinculadas)

### Categories (`/api/categories`)
- `GET /` — lista todas (seed cria: Reels, YouTube, TikTok, Podcast, Corporativo, Wedding)

### Uploads (`/api/uploads`)
- `POST /signature` — gera assinatura para upload direto ao Cloudinary
  - body: `{ folder: 'portfolio'|'avatars'|'orders'|'deliveries', resourceType?: 'image'|'video'|'auto' }`

### Orders — Status Flow (`/api/orders`)
- `PATCH /:id/status` — atualiza status da order (auth obrigatório)
  - body: `{ status: OrderStatus }`
  - Transições válidas por role:
    - **editor**: PENDING→ACCEPTED, PENDING→CANCELLED, ACCEPTED→IN_PROGRESS, ACCEPTED→CANCELLED, REVISION_REQUESTED→IN_PROGRESS
    - **creator**: PENDING→CANCELLED, ACCEPTED→CANCELLED, DELIVERED→COMPLETED, DELIVERED→REVISION_REQUESTED
    - **admin**: qualquer transição
  - Cria notificação automática para a contraparte em cada transição
  - Em COMPLETED: dispara `paymentService.releasePayment()` (Transaction→RELEASED)

- `POST /:id/deliveries` — editor envia entrega (EDITOR/BOTH/ADMIN)
  - body: `{ videoUrl: string, message?: string }`
  - Cria `Delivery` com version auto-incrementado
  - Transiciona automaticamente o order para DELIVERED
  - Cria notificação `DELIVERY_RECEIVED` para o creator

- `POST /:id/payment` — creator inicia pagamento via Abacatepay (CREATOR/BOTH/ADMIN)
  - Cria cobrança PIX no Abacatepay (se `ABACATEPAY_API_KEY` configurado)
  - Persiste `Transaction` com status PENDING
  - Retorna `{ paymentUrl }` — abrir no browser para pagamento
  - Sem chave configurada (dev): Transaction criada mas sem URL real

### Agreements — Contrato por pedido (`/api/orders/:id/agreement`)
- Gerado automaticamente no aceite da proposta (`agreementService.regenerateAgreement`)
  — snapshot imutável do termo (v1.0) com partes, valores, prazo; renegociação regenera e zera aceites
- `POST /accept` — registra o aceite da parte logada (creator ou editor); notifica a contraparte
  (`CONTRACT_ACCEPTED`); quando ambos aceitam, notifica o creator para pagar
- **Gate de pagamento:** `POST /orders/:id/payment` recusa enquanto ambos não aceitarem
- Regras codificadas do contrato (agreement.service): 2 revisões inclusas (revision.service bloqueia a 3ª),
  aprovação automática após 7 dias em DELIVERED (`orderService.autoApproveStaleDeliveries`, roda no login)
- O termo vem no `GET /orders/:id` (campo `agreement` com content + aceites)

### Termos de Uso da plataforma (cadastro)
- `POST /auth/register` exige `acceptTerms: true` (Zod literal) → grava `User.termsAcceptedAt`
- Texto em `packages/web/src/lib/terms.ts` (modal no RegisterPage, checkbox obrigatório)

### Revisions (`/api/orders/:id/revisions`) — auth
- `POST /` — creator solicita revisão (CREATOR/BOTH). Body: `{ deliveryId, description }`
  - Valida: order em DELIVERED, requester = creator, deliveryId é a entrega mais recente
  - Cria `Revision` (PENDING), order → REVISION_REQUESTED, notifica editor
- `GET /` — histórico de revisões (creator/editor do pedido ou admin), com versão da entrega
- Nova entrega do editor (`POST /:id/deliveries`) marca revisões PENDING como ADDRESSED automaticamente

### Disputes (`/api/orders/:id/dispute`)
- `POST /` — creator abre disputa (CREATOR/BOTH). Body: `{ reason }`
  - Válido a partir de DELIVERED ou REVISION_REQUESTED, 1 disputa por pedido
  - Cria `Dispute` (OPEN), order → DISPUTED (congelado), notifica editor + todos os admins
- `POST /resolve` — apenas ADMIN. Body: `{ resolution: 'RELEASE' | 'REFUND' }`
  - RELEASE → Transaction RELEASED, order → COMPLETED, incrementa totalJobs do editor
  - REFUND  → Transaction REFUNDED, order → CANCELLED
  - Dispute → RESOLVED_RELEASED/RESOLVED_REFUNDED, notifica ambas as partes

### Webhooks (`/api/webhooks`)
- `POST /abacatepay` — endpoint público para notificações do Abacatepay
  - Valida assinatura HMAC-SHA256 via header `x-abacatepay-signature` (se `ABACATEPAY_WEBHOOK_SECRET` configurado)
  - Em `billing.paid`: Transaction→HELD + notificação para o editor

### Conversations (`/api/conversations`) — todas exigem auth
- `POST /order/:orderId` — cria ou retorna a conversa vinculada ao pedido (1 conversa por order, `orderId @unique`)
- `GET /` — lista todas as conversas do usuário logado
- `GET /:id/messages` — lista mensagens (`?page=`, `?limit=`); marca as recebidas como lidas (`readAt`)
- `POST /:id/messages` — envia mensagem `{ content: string }` + cria notificação `NEW_MESSAGE`

### Notifications (`/api/notifications`) — todas exigem auth
- `GET /` — lista notificações do usuário logado
- `PATCH /read-all` — marca todas como lidas
- `PATCH /:id/read` — marca uma como lida

### Subscriptions (`/api/subscriptions`) — auth + EDITOR/BOTH
- `POST /` — editor assina o Premium (R$ 39,90/mês)
  - Bloqueia se já houver assinatura ACTIVE fora da janela de renovação (últimos 5 dias)
  - Cria `Subscription` PENDING (`amount` Decimal, `expiresAt` null) + cobrança PIX no Abacatepay
  - Dev (sem `ABACATEPAY_API_KEY`): confirma na hora (`devConfirmed: true`)
  - Retorna `{ paymentUrl, pixCode, pixQrCode, expiresAt, devConfirmed }`
- `GET /me` — status atual: `{ isPremium, premiumExpiresAt, price, subscription }`
- Confirmação via webhook `billing.paid`: se o `externalId` não casar com nenhuma `Transaction`,
  procura `Subscription` por `externalSubscriptionId` → `confirmSubscriptionPayment`
  (status ACTIVE, `expiresAt` = agora/vencimento + 30d, `EditorProfile.isPremium = true`)
- Expiração: `checkAndExpireSubscriptions()` roda no login — vencidas → EXPIRED + `isPremium = false`

### Payments (`/api/payments`) — auth
- `GET /me` — histórico de pagamentos do creator logado (CREATOR/BOTH/ADMIN), 20/pág
  - Transações onde `payerId = user`, com resumo do pedido (título, editor, categoria, status)
  - `summary`: { totalPaid (HELD+RELEASED), totalHeld, totalCompleted (RELEASED) }

### Audit Log (trilha de auditoria)
- Modelo `AuditLog` (actorId nullable = evento de sistema, action, entityType, entityId, metadata Json,
  índices por entidade/ator/ação); `audit.service.logEvent()` é fire-safe (falha não derruba o fluxo)
- Eventos registrados: ORDER_CREATED, ORDER_CANCELLED, PROPOSAL_ACCEPTED, PAYMENT_INITIATED,
  PAYMENT_CONFIRMED (webhook/dev = Sistema), PAYMENT_RELEASED, PAYMENT_REFUNDED, REVISION_REQUESTED,
  DISPUTE_OPENED, DISPUTE_RESOLVED, SUBSCRIPTION_ACTIVATED, USER_BANNED/UNBANNED
- `GET /api/admin/audit-log` — ADMIN, 30/pág; filtros: `?entityType=`, `?action=`, `?actorId=`,
  `?actorSearch=` (nome/email), `?orderId=` (atalho para entityType=Order)

### Requests — Marketplace invertido (`/api/requests`) — auth em todas
Creator publica `ProjectRequest` (OPEN) → editores enviam `RequestProposal` → creator aceita uma →
nasce um `Order` já com editor, em `AWAITING_PAYMENT`, que segue o pipeline normal (contrato → pagamento → entrega).
- Rotas estáticas registradas antes de `/:id`: `GET /mine` (creator), `GET /proposals/mine` (editor)
- **Creator (CREATOR/BOTH)**
  - `POST /` — `{ categoryId, title, description, budgetMin?, budgetMax?, deadline?, revisionsIncluded?, referenceLinks? }`
    (min ≤ max, prazo futuro, banido não publica)
  - `GET /mine` — 20/pág, com `proposalCount`, `pendingProposalCount` e `pendingProposalsTotal` (badge da nav)
  - `PATCH /:id` — edita título/descrição/orçamento/prazo/links (só OPEN; permitido mesmo com propostas)
  - `POST /:id/cancel` — só OPEN → CANCELLED, propostas PENDING viram REJECTED + notificação
  - `POST /:id/proposals/:proposalId/accept` — **transação única**: guard otimista OPEN→FILLED, cria Order
    (budget = proposta, platformFee via `Prisma.Decimal`, AWAITING_PAYMENT, deadline = request.deadline ?? hoje + deliveryDays,
    revisionsIncluded herdado), cria OrderProposal ACCEPTED, gera contrato (`ensureAgreement(orderId, tx)`),
    rejeita as demais + notifica ("fechado com outro editor"), notifica o vencedor com `relatedOrderId`. Retorna `{ orderId }`
  - `POST /:id/proposals/:proposalId/reject` — recusa uma; solicitação continua OPEN
- **Editor (EDITOR/BOTH)**
  - `GET /` — quadro só OPEN, 20/pág, filtros `?category=&budgetMin=&budgetMax=&search=&sort=recent|budget_desc`
    (faixas por sobreposição); exclui as próprias do BOTH; item traz `descriptionPreview` (200 chars, sem links/arquivos)
    e `myProposal: { status } | null`
  - `POST /:id/proposals` — `{ amount > 0, deliveryDays, message }`; duplicata → **409**; própria solicitação → 403;
    FILLED/CANCELLED → 400; banido → 403. Proposta WITHDRAWN pode ser reenviada (reaproveita a linha)
  - `PATCH /:id/proposals/mine` / `DELETE /:id/proposals/mine` — editar / retirar (só PENDING)
  - `GET /proposals/mine` — histórico com status + `orderId` (só para o vencedor)
- `GET /:id` — o service decide a perspectiva: **creator/admin** vê todas as propostas (dados públicos do editor,
  `?sort=amount|rating`, pendentes primeiro); **editor** vê descrição completa + links + só a própria proposta
  (solicitação fechada só fica visível para quem participou). **Nunca** expõe arquivos — continuam atrás de IN_PROGRESS no pedido
- Notificações: `REQUEST_PROPOSAL_RECEIVED|ACCEPTED|REJECTED` com `relatedRequestId` (novo campo em Notification)
- Auditoria: `REQUEST_CREATED`, `REQUEST_CANCELLED`, `REQUEST_PROPOSAL_SENT`, `REQUEST_PROPOSAL_ACCEPTED`
  (+ `ORDER_CREATED` do pedido gerado)
- Trace E2E versionado: `pnpm --filter @cutmakers/api trace:requests` (API rodando, dev mode de pagamento)

### Admin (`/api/admin`) — auth + requireRole(ADMIN) em todas
- `GET /users` — lista paginada (20/pág). Filtros: `?search=` (nome/email), `?role=`, `?page=`
  - Retorna id, name, email, role, banned, isPremium (join EditorProfile), createdAt
- `PATCH /users/:id/ban` / `PATCH /users/:id/unban` — suspende/reativa (bloqueia banir ADMIN)
- `GET /orders` — lista paginada (20/pág), `?status=`. Retorna id, creatorName, editorName, status, budget, createdAt
- `GET /disputes` — disputas OPEN, mais antigas primeiro (createdAt asc), com order + partes + reason
- `GET /financial-summary` — { totalTransacted, totalPlatformFees (RELEASED), totalHeldInEscrow (HELD), totalRefunded (REFUNDED) }
- `GET /transactions` — lista paginada (50/pág): orderId, payerName, payeeName, amount, platformFee, status, createdAt
- Resolução de disputa reusa `POST /api/orders/:id/dispute/resolve` (ADMIN); `GET /api/orders/:id` já aceita ADMIN

**Login:** `user.banned === true` → 401 "Conta suspensa. Entre em contato com o suporte."

---

## 🚀 Como rodar

```powershell
# Instalar dependências
pnpm install

# Configurar banco (primeira vez)
pnpm --filter @cutmakers/api db:push

# Seed (cria admin + categorias)
pnpm --filter @cutmakers/api db:seed

# Rodar tudo
pnpm api    # backend na porta 3333
pnpm web    # frontend na porta 5173
```

### Credenciais admin (criadas pelo seed)
- Email: `cutmakers@admin.com`
- Senha: `cutmakers@123`

### Variáveis de ambiente
Ver `packages/api/.env.example`. Precisa:
- `DATABASE_URL` + `DIRECT_URL` (Supabase)
- `JWT_SECRET` + `JWT_REFRESH_SECRET`
- `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`
- `ABACATEPAY_API_KEY` + `ABACATEPAY_WEBHOOK_SECRET` (Fase 3 — opcional em dev)
- `FRONTEND_URL` (padrão `http://localhost:5173`, usado no returnUrl do Abacatepay)
- `CORS_ORIGIN` (produção — lista separada por vírgula de origens permitidas; sem a var, libera todas em dev)

> **Deploy:** feito manualmente pelo dono do projeto. Nada de Docker/Caddy/Compose no repo
> — não criar/editar esses arquivos.

---

## 📊 Progresso

```
✅ Fase 1 — Base
   [x] Monorepo pnpm workspaces
   [x] API Express + TypeScript + Prisma
   [x] Schema Prisma completo (20 modelos)
   [x] Auth: register, login, refresh, JWT middleware
   [x] Seed do admin + categorias
   [x] Frontend: Login, Register, AdminPage (com switcher de view)

✅ Fase 2 — Core Editor
   [x] CRUD EditorProfile + middleware requireRole
   [x] Upload signed do Cloudinary
   [x] CRUD PortfolioItem (com ownership check)
   [x] Listagem de editores com filtros
   [x] Dashboard Editor (overview + portfólio + perfil)
   [x] Dashboard Creator (feed + busca + filtros)
   [x] Perfil público do editor

✅ Fase 3 — Core Creator
   [x] Criar Order com upload de OrderFile
   [x] Fluxo de status da Order (PENDING → ACCEPTED → IN_PROGRESS → DELIVERED → COMPLETED)
       — Transições validadas por role (creator/editor/admin)
       — Notificações automáticas em cada transição
   [x] Envio de entregas pelo editor (POST /orders/:id/deliveries)
       — Upload de vídeo para Cloudinary (folder 'deliveries')
       — Versionamento automático (v1, v2, v3...)
       — Transição automática para DELIVERED
   [x] Integração Abacatepay (escrow)
       — POST /orders/:id/payment → cria cobrança PIX
       — Webhook POST /api/webhooks/abacatepay → confirma pagamento (Transaction→HELD)
       — Em COMPLETED: Transaction→RELEASED (liberação ao editor)
   [x] Order Detail Page (/orders/:id)
       — Status stepper visual (5 steps)
       — Ações contextuais por role + status
       — Histórico de entregas com links para vídeo
       — Sidebar financeiro (budget, taxa, net)
       — Status do pagamento (escrow)

✅ Fase 3.5 — Design System (Landing + Creator UI)
   [x] LandingPage pública (Nav, Hero, HowItWorks, Categorias, Editores, Stats, CTA, Footer)
   [x] CMLogo/CMLockup SVG component (variantes orange/navy/inverse)
   [x] DashboardShell: active item sólido #F4631E, logo CMLockup, navLabel prop
   [x] CreatorDashboard — Buscar Editores:
       — EditorCard redesenhado: thumbnail 16:10 diagonal, play button, badge, avatar colorido
       — Barra de busca: input + select categoria + select ordenação + botão Buscar
       — Chips de filtro: Todos + categorias + Premium (filtra via API)
       — Ordenação client-side: rating, jobs, price-asc/desc
       — Nav estendida: Mensagens, Favoritos, Pagamentos, Minha conta (placeholders)
       — Badge dinâmico em Meus Pedidos com contagem real
   [x] EditorPublicProfile redesenhado:
       — Navbar própria com CMLockup + botão Voltar + bell + avatar do usuário logado
       — Breadcrumb dinâmico: Buscar editores > [categoria] > [nome]
       — Hero banner (diagonal texture): avatar grande, PREMIUM badge, rating, preço
       — Botões: Mensagem (disabled — Fase 4) + Contratar (abre NewOrderModal)
       — Stats row: totalJobs, avgRating %, tempo médio (—), aprovação 1ª entrega (—)
       — Portfólio com tabs de categoria + grid 4:3 com overlay play + badge + título
       — Sidebar Pacotes: 3 tiers derivados do portfólio (Express/Pro/Studio, Pro destacado)
       — Sidebar Especialidades, Avaliações empty state (Fase 5)

✅ Fase 3.6 — Reviews/Ratings
   [x] review.service.ts: createReview + getEditorReviews
       — Valida: order COMPLETED, reviewer = creator, sem review existente
       — Recalcula EditorProfile.avgRating via prisma.$transaction após cada review
   [x] review.controller.ts: POST /orders/:id/review, GET /editors/:id/reviews
   [x] order.service.ts: orderDetailInclude + toDetailDTO agora incluem review (com reviewer)
   [x] Frontend lib/reviews.ts: ReviewDTO, ReviewsResponse, createReview(), getEditorReviews()
   [x] OrderDetailPage: StarRating interativo, ReviewFormSection (só para creator em COMPLETED)
       — Exibe card da avaliação já enviada se order.review existe
   [x] EditorPublicProfile: avaliações reais paginadas (5/página), "Ver mais" incremental
       — ReviewCard: avatar colorido + nome + categoria + data relativa + estrelas + comentário
   [x] Novo endpoint: GET /api/editors/:id/reviews (público, sem auth)
   [x] Novo endpoint: POST /api/orders/:id/review (requireRole CREATOR/BOTH)

✅ Fase 4.2 — Negociação + Payment Gate
   [x] OrderProposal model + ProposalStatus enum no schema
   [x] NEGOTIATING + AWAITING_PAYMENT adicionados ao OrderStatus
   [x] PROPOSAL_RECEIVED, PROPOSAL_ACCEPTED, PROPOSAL_REJECTED, PAYMENT_CONFIRMED no NotificationType
   [x] proposal.service.ts: create, list, accept, reject
       — Somente 1 proposta PENDING por vez por pedido
       — Quem enviou a última não pode reenviar até resposta
       — Aceitar → order.budget + platformFee recalculados, order → AWAITING_PAYMENT
       — Rejeitar → order permanece NEGOTIATING
   [x] proposal.controller.ts + rotas em order.routes.ts
   [x] Order.create() → status NEGOTIATING + auto-cria primeira proposta do creator
   [x] payment.service.ts: aceita AWAITING_PAYMENT (e ACCEPTED legacy)
   [x] Webhook billing.paid → Transaction HELD + Order → IN_PROGRESS (new flow)
   [x] Editor não vê arquivos do creator em NEGOTIATING/AWAITING_PAYMENT (filesHidden gate)
   [x] Frontend lib/proposals.ts: ProposalDTO, createProposal, acceptProposal, rejectProposal
   [x] OrderDetail redesenhado:
       — NegotiationSection: histórico chat-like, cards por partido, Accept/Reject/Counter
       — AwaitingPaymentSection: creator (PIX card + pay button), editor (waiting state)
       — ProposalForm: inline com preview de taxa + valor líquido
       — StatusStepper: novo happy path NEGOTIATING→AWAITING_PAYMENT→IN_PROGRESS→DELIVERED→COMPLETED
       — File gate visual: cadeado para editor antes de IN_PROGRESS

✅ Fase 4.3 — Chat/Mensagens (Conversations)
   [x] conversation.service.ts: getOrCreateByOrder, listForUser, getMessages, sendMessage
       — 1 Conversation por order (`orderId @unique`), criada sob demanda
       — Auto-read ao buscar mensagens (`readAt` setado)
       — Notificação `NEW_MESSAGE` a cada mensagem enviada
   [x] conversation.controller.ts + conversation.routes.ts (montadas em /api/conversations)
   [x] Frontend lib/conversations.ts (tipos + API calls)
   [x] ChatPanel.tsx: widget com polling 3s, bolhas orange/dark, auto-scroll, Enter para enviar
   [x] MessagesTab.tsx: lista de conversas (300px) + ChatPanel; usada nos dashboards
   [x] Widget de chat colapsável no OrderDetail

✅ Fase 4.4 — Notifications
   [x] notification.service.ts: create + list + markOneRead + markAllRead
       — Notificações disparadas em transições de status, entregas, propostas, pagamento e chat
   [x] notification.controller.ts + notification.routes.ts (montadas em /api/notifications)
   [x] Frontend lib/notifications.ts (tipos + API calls)
   [x] NotificationType cobre: NEW_ORDER, NEW_MESSAGE, DELIVERY_RECEIVED, REVISION_REQUESTED,
       PAYMENT_RELEASED, ORDER_ACCEPTED, ORDER_CANCELLED, PROPOSAL_*, PAYMENT_CONFIRMED

✅ Fase 4.5 — Type hardening (tsc --noEmit limpo)
   [x] `tsc --noEmit` passa sem erros em @cutmakers/api e @cutmakers/web
   [x] Controllers: `req.params.id as string` nos handlers de editor/order/portfolio
       (Express tipa params como `string | string[]`)
   [x] auth.service.ts: jwt.sign tipado com `Secret` + `SignOptions` (sem `any`)
   [x] app.ts + todas as rotas anotadas com `: Express` / `: Router`
       — resolve TS2742 (declaration emit não conseguia nomear tipo transitivo do express)
   [x] AdminPage.tsx: removido `statusColors` morto em OrdersSection (placeholder)

✅ Fase 5 — Revisões formais + Disputas
   [x] Revision: revision.service.ts (createRevision, listRevisions, markAddressedOp)
       — createRevision valida DELIVERED + creator + entrega mais recente; order → REVISION_REQUESTED
       — nova entrega do editor marca revisões PENDING como ADDRESSED (atômico no createDelivery)
   [x] revision.controller.ts + rotas GET/POST /api/orders/:id/revisions
   [x] Dispute: novo modelo Dispute + enum DisputeStatus (OPEN/RESOLVED_RELEASED/RESOLVED_REFUNDED)
       — dispute.service.ts (openDispute, resolveDispute); payment.service.refundPayment (Transaction REFUNDED)
       — openDispute: DELIVERED/REVISION_REQUESTED → DISPUTED (congelado), notifica editor + admins
       — resolveDispute (ADMIN): RELEASE → COMPLETED/RELEASED (+totalJobs); REFUND → CANCELLED/REFUNDED
   [x] dispute.controller.ts + rotas POST /api/orders/:id/dispute e /dispute/resolve
   [x] NotificationType: + DISPUTE_OPENED, DISPUTE_RESOLVED
   [x] order.service: orderDetailInclude/toDetailDTO agora incluem `revisions` e `dispute`
   [x] Frontend lib/revisions.ts + lib/disputes.ts; OrderDetailDTO com revisions + dispute
   [x] OrderDetail UI:
       — creator DELIVERED: form "O que precisa ser alterado?" (substitui botão simples) + "Abrir disputa"
       — editor REVISION_REQUESTED/IN_PROGRESS: PendingRevisionCard destacado acima do upload
       — Histórico de revisões (versão-alvo, descrição, Pendente/Resolvida, data) abaixo das entregas
       — DISPUTED: banner "Em disputa — aguardando análise da CutMakers" (ambas as partes, ações escondidas)
       — admin: botões "Liberar ao editor" / "Reembolsar creator" no banner de disputa
   [x] `tsc --noEmit` limpo em api + web, sem `any`
   ⚠️ Requer `pnpm --filter @cutmakers/api db:push` para sincronizar o novo modelo Dispute + enums

✅ Fase 6 — Subscription premium do editor
   [x] Schema: SubscriptionStatus + PENDING; Subscription.amount (Decimal) + expiresAt nullable + default PENDING
   [x] subscription.service.ts:
       — createSubscription (guard ACTIVE fora da janela de renovação de 5 dias; cria PENDING + cobrança PIX)
       — getMySubscription ({ isPremium, premiumExpiresAt, price, subscription })
       — confirmSubscriptionPayment (ACTIVE + expiresAt now/vencimento + 30d; EditorProfile.isPremium = true)
       — checkAndExpireSubscriptions (vencidas → EXPIRED + isPremium false) — chamada no login
   [x] payment.service: createPixCharge reutilizável (orders + assinaturas); dev mode auto-confirma
   [x] Webhook billing.paid distingue Transaction (order) vs Subscription (externalSubscriptionId)
       — lazy import de subscription.service evita ciclo de dependência
   [x] subscription.controller.ts + subscription.routes.ts (POST / e GET /me, EDITOR/BOTH)
   [x] auth.controller.login → checkAndExpireSubscriptions() (expiração sem cron)
   [x] Frontend lib/subscriptions.ts + EditorDashboard: nav "Premium" + PremiumSection
       — free: benefícios + CTA "Assinar Premium — R$39,90/mês" + card PIX
       — premium: badge ATIVO + "Válido até DD/MM/AAAA" + "Renovar" (habilitado nos últimos 5 dias)
   [x] Badge PREMIUM já visível no EditorCard (feed) e EditorPublicProfile; filtro ?premium=true intacto
   [x] `tsc --noEmit` limpo em api + web, sem `any`
   ⚠️ Requer `pnpm --filter @cutmakers/api db:push` (Subscription.amount/expiresAt + enum PENDING)

✅ Fase 7 — Painel Admin avançado
   [x] Schema: User.banned (Boolean @default(false))
   [x] admin.service.ts: listUsers, setBanned, listOrders, listOpenDisputes, financialSummary, listTransactions
       — DTOs sem passwordHash; Decimal→Number; isPremium via join EditorProfile
   [x] admin.controller.ts + admin.routes.ts (montadas em /api/admin, authMiddleware + requireRole(ADMIN))
       — GET /users (?search=&role=&page=, 20/pág), PATCH /users/:id/ban|unban (bloqueia banir ADMIN)
       — GET /orders (?status=, 20/pág), GET /disputes (OPEN asc)
       — GET /financial-summary, GET /transactions (50/pág)
   [x] auth.controller.login: user.banned → 401 "Conta suspensa. Entre em contato com o suporte."
   [x] Frontend lib/admin.ts + AdminPage:
       — Usuários: busca debounced + filtro de role + badge premium/status + Ver perfil (editores) + Banir/Desbanir (modal)
       — Ordens: filtro de status, linha DISPUTED destacada em laranja + modal "Resolver disputa"
         (resumo, motivo, Liberar para editor / Reembolsar criador via resolveDispute); clique → /orders/:id
       — Financeiro: 4 cards de resumo + tabela de transações (50/pág)
       — Pagination/Spinner/EmptyState reutilizados; Modal existente reusado; view switcher Admin/Creator/Editor intacto
   [x] `tsc --noEmit` limpo em api + web, sem `any`
   ⚠️ Requer `pnpm --filter @cutmakers/api db:push` (novo campo User.banned)

✅ Fase 8 — Preparo p/ produção (só app; deploy é manual do dono)
   [x] app.ts: CORS por env `CORS_ORIGIN` (lista; sem a var = libera tudo em dev) + `GET /health`
   [x] Prisma: baseline `prisma/migrations/0_init` (migrate diff) + `prisma` em dependencies;
       .gitignore versiona migrations/ e protege `.env*` (mantém `*.example`)
   [x] Sem cookies no backend (JWT em Authorization header + localStorage) → sem secure/sameSite
   [x] Builds de produção validados: `api build` → dist/index.js, `web build` → dist/ ok; `tsc --noEmit` limpo
   ❌ Docker/Caddy/Compose REMOVIDOS do repo — o deploy é feito 100% manualmente pelo dono.
      Não recriar/editar Dockerfile, docker-compose, Caddyfile, nginx.conf, DEPLOY.md, etc.

✅ Fase 9 — PD1: UX/Performance/Higiene
   [x] Code splitting: App.tsx com React.lazy + Suspense — cada página vira chunk próprio
       (resolve "todas as páginas buildadas ao acessar o site"; 40 chunks no build)
   [x] Favicon SVG (public/favicon.svg, marca CMLogo) + meta description no index.html
   [x] DashboardShell: header enxuto (só ações da página + sino), avatar removido do header
       — perfil clicável no rodapé da sidebar (prop onProfileClick)
       — sidebar colapsável (toggle "Reduzir menu", persistido em localStorage, ícones + tooltips)
   [x] NotificationBell validado (já existia: dropdown, badge não lidas, marcar uma/todas, polling 20s)
   [x] MessagesTab ocupa a altura toda (calc(100vh - 124px) — antes sobrava espaço)
   [x] Filtro de pedidos por status: OrderStatusFilter (chips com contagem) nos dashboards creator+editor
   [x] Portfólio:
       — categoria "Outros" no PortfolioForm → input livre; backend find-or-create case-insensitive
         (portfolio.controller: categoryName no create/update; portfolio.service.resolveCategoryId)
       — descrição visível nos cards (dashboard) e no overlay do grid (perfil público)
       — previews não-16:9 não quebram mais: object-contain sobre fundo desfocado (blur)
       — exclusão com Modal de confirmação (substitui window.confirm/alert)
   [x] Perfil do editor inline: seção "Perfil" renderiza ProfileForm dentro do dashboard (sidebar visível);
       clicar no avatar/nome da sidebar abre o perfil
   [x] Dashboard do editor com gráficos: StatusBarChart (pedidos por status, SVG puro) +
       UpcomingDeadlines (prazos ≤7 dias com urgência colorida) — sem dependências novas
   [x] EditorPublicProfile: "Pacotes" → "Contratação", tiers filtrados pela categoria ativa das tabs
       (preço de Reels aparece ao selecionar Reels), badge de categoria por tier
   [x] Higiene: sem console.log/alert no web (Google login vira botão disabled "Em breve");
       prisma já loga só 'error' fora de dev; CORS por env (Fase 8); AuthUser.avatarUrl opcional
   [x] `tsc --noEmit` + builds de produção limpos em api + web, sem `any`

✅ Fase 10 — Contratos e Termos (aceite eletrônico de ambas as partes)
   [x] Schema: OrderAgreement (orderId @unique, termsVersion, content snapshot, creatorAcceptedAt,
       editorAcceptedAt) + User.termsAcceptedAt + NotificationType.CONTRACT_ACCEPTED
   [x] agreement.service.ts: template do Termo de Prestação de Serviço (12 cláusulas, equilibrado
       editor/criador) gerado com dados reais do pedido; constantes: 2 revisões, 7d auto-aprovação
       — ensureAgreement (self-healing), regenerateAgreement (renegociação zera aceites),
         acceptAgreement (valida parte, notifica contraparte / criador quando ambos aceitam)
   [x] proposal.accept → regenerateAgreement; payment.initiatePayment → gate "ambos aceitaram"
   [x] revision.service: máximo 2 revisões inclusas (cláusula 3b)
   [x] order.service.autoApproveStaleDeliveries: DELIVERED >7d → COMPLETED + release + notifs
       (cláusula 4b) — chamado no login junto com expiração de assinaturas
   [x] auth.register: acceptTerms obrigatório (z.literal(true)) → User.termsAcceptedAt
   [x] Frontend: lib/terms.ts (Termos de Uso da plataforma, 12 cláusulas — intermediação,
       responsabilidade de cada parte, escrow/taxa, LGPD), lib/agreements.ts
   [x] RegisterPage: checkbox obrigatório + modal com termos ("Li e aceito" marca o checkbox)
   [x] OrderDetail: ContractSection (status de aceite por parte, texto expandível, botão
       "Li e aceito os termos", imprimir/salvar PDF); botão de pagar bloqueado até ambos aceitarem
   [x] Abas do creator reorganizadas: pré-pagamento = Pagamento / Briefing & Arquivos / Mensagens;
       pós-pagamento a aba Pagamento some → Briefing (contrato + entregas + aprovar/revisar + sidebar
       financeiro) / Arquivos / Mensagens
   [x] Confirmações: modal ao "Aprovar entrega" (mostra valor liberado, irreversível — cláusula 4a)
       e ao "Solicitar revisão" (mostra Nª de 2 inclusas + preview da solicitação)
   [x] tsc --noEmit + builds limpos em api + web, sem `any`; db push aplicado

✅ Fase 11 — Auditoria + aba Pagamentos do creator
   [x] Schema: AuditLog (actorId nullable p/ eventos de sistema, metadata Json, 3 índices) — db push aplicado
   [x] audit.service.logEvent() fire-safe (try/catch — log nunca derruba o fluxo principal)
   [x] 13 eventos ligados nos services: order create/cancel, proposal accept (amount+fee),
       payment initiated/confirmed (webhook e dev)/released/refunded (com valores), revision,
       dispute open (reason)/resolve (resolution + movimento do escrow), subscription activated,
       user banned/unbanned (setBanned agora recebe adminId)
       — releasePayment/refundPayment ganharam actorId opcional (creator aprova / admin resolve / null = auto)
   [x] GET /api/admin/audit-log (30/pág; entityType/action/actorId/actorSearch/orderId) — Zod + DTO com ator
   [x] AdminPage aba "Auditoria": badges coloridos por tipo (pagamento verde, disputa laranja, ban vermelho),
       ator ou "Sistema", linha expansível com metadata formatada (Valor: R$ 200,00 — não JSON cru),
       filtro por ação + busca por usuário debounced + paginação
   [x] GET /api/payments/me (CREATOR/BOTH, 20/pág): transações do payer + resumo do pedido +
       summary { totalPaid, totalHeld, totalCompleted }
   [x] CreatorDashboard aba "Pagamentos" real (substitui placeholder): 3 cards de resumo,
       tabela com projeto (clica → /orders/:id), editor, valor, badge de status, data,
       empty state com CTA "Explorar editores", paginação
   [x] Trace E2E validado (script): criar → negociar → contrato → pagar → HELD na aba →
       entregar → aprovar → RELEASED na aba; auditoria com a sequência completa
       (ORDER_CREATED → PROPOSAL_ACCEPTED → PAYMENT_INITIATED → PAYMENT_CONFIRMED [Sistema] → PAYMENT_RELEASED)
   [x] tsc --noEmit + builds limpos em api + web, sem `any`

✅ Fase 11.1 — Fix landing page
   [x] CTA final: removida a promo inexistente "Comece com o primeiro vídeo grátis / R$100 de
       crédito" (feature nunca existiu) → novo copy real sobre conta grátis + escrow;
       botão morto "Falar com vendas" removido
   [x] Cards do CTA ajustados pra claims reais: escrow, contrato por projeto, mediação de
       disputas (no lugar de "entrega 24-72h" e "suporte WhatsApp", que não existem)
   [x] Redução geral de escala (~20-25%): hero, h2 de seções, stats, títulos de card e
       paddings de seção todos reduzidos — estava desproporcional em telas grandes

✅ Fase 12 — PD2: Marketplace invertido (editor envia proposta pro criador)
   Decisões de produto travadas:
     1. Visibilidade: quadro público filtrado por categoria
     2. 1 proposta ativa por editor por solicitação (editável/retirável enquanto PENDING); sem prazo mínimo p/ fechar
     3. Aceite de uma → demais PENDING viram REJECTED + notificação "fechado com outro editor"
     4. Concorrentes veem descrição completa + links de referência, NUNCA arquivos (gate IN_PROGRESS intacto)
   Decisões técnicas:
     — **`Order.editorId` continua obrigatório** (não virou nullable). A fase "sem editor" vive inteira em
       `ProjectRequest`; o Order só nasce no aceite, já com o editor da proposta. Nullable espalharia
       `string | null` + guards de um estado impossível por ~10 services e DTOs; com o campo obrigatório,
       o próprio tipo do Prisma garante que dispute/revision/agreement/notificações nunca veem editor nulo
     — **`Conversation.editorId` também obrigatório**: a conversa já é criada sob demanda e só para pedidos
       (getOrCreateByOrder) — não existe conversa na fase de solicitação
     — `Order.revisionsIncluded` (default 2) + `Order.requestId @unique` novos; contrato (TERMS_VERSION 1.1)
       e limite do revision.service passam a usar o valor do pedido em vez da constante fixa
     — `agreementService.ensureAgreement(orderId, db = prisma)` aceita client de transação → contrato gerado
       atomicamente no aceite
     — Corrida aceite×aceite / aceite×cancelamento: `updateMany where status OPEN` como guard otimista → 409
     — `Conflict` (409) adicionado em lib/errors.ts; banimento checado no service (não só na UI)
   [x] Schema: enums RequestStatus/RequestProposalStatus, models ProjectRequest/RequestProposal,
       Order.requestId/revisionsIncluded, Notification.relatedRequestId, 3 NotificationType novos
   [x] project-request.service/controller/routes (/api/requests) — 12 endpoints, Zod, DTOs, Decimal→Number
   [x] Auditoria: 4 ações novas + entityTypes ProjectRequest/RequestProposal (filtro admin + labels na aba Auditoria)
   [x] Frontend lib/requests.ts + components/requests/: shared, RequestFormModal (criar/editar),
       CreatorRequestsSection (lista + detalhe + aceitar/recusar/cancelar com modais de confirmação e
       breakdown "você paga / plataforma retém / editor recebe"), OpportunitiesSection (quadro + filtros +
       OpportunityDetailModal), ProposalFormModal (preview ao vivo "Você recebe"), MyProposalsSection
   [x] CreatorDashboard: nav "Minhas solicitações" com badge de propostas pendentes; aceite redireciona p/ /orders/:id
   [x] EditorDashboard: navs "Oportunidades" e "Minhas propostas"; seção sincronizada com `?section=` na URL
   [x] Notificações: ícones dos 3 tipos novos (+ CONTRACT/DISPUTE que faltavam); clique navega por tipo
       (RECEIVED → detalhe da solicitação, ACCEPTED → pedido, REJECTED → Minhas propostas)
   [x] OrderDetail: "Nª de N revisões inclusas" usa order.revisionsIncluded
   [x] tsc --noEmit + builds de produção limpos em api + web, sem `any`
   [x] Trace E2E versionado em packages/api/scripts/trace-request-flow.mjs (fluxo completo + edge cases:
       409 duplicada, BOTH na própria, aceite em FILLED, edição com propostas, cancelamento com pendentes,
       pipeline contrato→pagamento→entrega→aprovação intacto, auditoria)
   ⚠️ Requer `pnpm --filter @cutmakers/api db:push` antes de rodar (o dono executa); depois `trace:requests`

⏳ Fase 13 — Próximos (pendem decisão/credenciais do dono)
   [ ] Migration versionada das Fases 10–12 (hoje só existe o baseline 0_init; as mudanças posteriores
       foram aplicadas via db push — produção com `migrate deploy` precisa de um 1_... gerado por migrate diff)
   [ ] Decidir se edição de solicitação deve travar campos (orçamento/descrição) após a 1ª proposta
   [ ] Login com Google funcional (requer GOOGLE_CLIENT_ID/SECRET do Google Cloud — decisão do dono)
   [ ] Renovação recorrente automática de assinatura (hoje é cobrança única mensal)
   [ ] Aprovação/verificação manual de editores pelo admin (badge verificado curado)
   [ ] Testes automatizados (nenhum ainda em api/web)
   [ ] Mobile React Native (planejado — fase futura)
```

---

## 🧠 Convenções de código

### Backend
- `HttpError` em `src/lib/errors.ts` — services lançam `throw NotFound('...')`, controllers usam `next(err)`, `errorMiddleware` mapeia status
- DTOs nos services (toListDTO, toFullDTO) — nunca retornar `passwordHash`, sempre converter `Decimal` para `Number`
- Zod nos controllers para validar input
- Includes do Prisma tipados com `satisfies Prisma.XInclude` + `Prisma.XGetPayload<{ include }>`
- Transactions para operações compostas (ex: User + EditorCategory)

### Frontend
- `api` (axios) em `src/lib/api.ts` já tem interceptor de refresh token
- Hooks customizados em `src/hooks/` para data fetching (`use-categories`, `use-editor-me`)
- Modal genérico em `src/components/ui/Modal.tsx`
- Layout reutilizável em `src/components/layout/DashboardShell.tsx`
- Cores do design system **sempre como style inline** (`style={{ background: '#162436' }}`) ou classes Tailwind customizadas (`text-brand`, `bg-navy-mid`)
- Ícones: `@tabler/icons-react` (outline)

---

## 🚨 Coisas que NÃO devem ser feitas

- ❌ Adicionar seletor de role na tela de login
- ❌ Criar endpoint público de criação de admin
- ❌ Usar Supabase Auth ou Supabase Storage
- ❌ Subir vídeos pelo servidor (sempre signed upload direto ao Cloudinary)
- ❌ Retornar `passwordHash` em qualquer DTO
- ❌ Commitar `.env` (já está no `.gitignore`)
- ❌ Quebrar a paleta de cores ou trocar as fontes
