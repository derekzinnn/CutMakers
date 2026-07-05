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
   [x] Schema Prisma completo (17 modelos)
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

⏳ Fase 10 — Próximos (pendem decisão/credenciais do dono)
   [ ] Login com Google funcional (requer GOOGLE_CLIENT_ID/SECRET do Google Cloud — decisão do dono)
   [ ] Geração de documento/contrato para aceite de ambas as partes por pedido
       (proposta: termos gerados no aceite da proposta + aceite registrado antes do pagamento)
   [ ] Modo de publicação de projeto para CREATORS (marketplace invertido — feature grande, própria fase)
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
