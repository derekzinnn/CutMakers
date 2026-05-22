# CutMakers — Briefing completo do projeto

> Documento de referência atualizado. Reflete o estado real do código em produção.
> Última atualização: 2026-05-22

---

## 1. O que é o CutMakers

Plataforma de marketplace que conecta **criadores de conteúdo** (influenciadores que precisam editar vídeos) a **editores freelancers** profissionais. Funciona como um Fiverr focado exclusivamente em edição de vídeo, com escrow de pagamento e sistema de portfólio.

**Problema que resolve:**
- Influenciadores perdem muito tempo editando o próprio conteúdo
- Criadores precisam de estrutura profissional sem contratar agências
- Editores freelancers têm dificuldade de encontrar clientes recorrentes

**Monetização:**
- Taxa de 10% sobre cada trabalho concluído (retida via escrow)
- Assinatura premium para editores (destaque no feed, badge verificado)

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Monorepo | pnpm workspaces |
| Backend API | Node.js + Express + TypeScript |
| ORM | Prisma 5 |
| Banco de dados | Supabase (PostgreSQL gerenciado) |
| Frontend web | React 18 + Vite + TypeScript + shadcn/ui + Tailwind v3 |
| Mobile | React Native (planejado — Fase futura) |
| Upload de arquivos/vídeos | Cloudinary (signed direct upload do frontend) |
| Pagamentos | Abacatepay (escrow via PIX) |
| Ícones | Tabler Icons (outline only) |
| Fontes | Syne (headings 700/800) + DM Sans (body 300/400/500) |

### Supabase — decisões técnicas importantes

- O Prisma conecta via `DATABASE_URL` (connection string do Supabase).
- **NÃO usar** Supabase Auth — autenticação é feita com **JWT próprio** no Express para controle total do campo `role`.
- **NÃO usar** Supabase Storage — todos os uploads vão para o **Cloudinary**.
- Usar Supabase apenas como banco PostgreSQL.
- Usar **connection pooling** via `?pgbouncer=true` na `DATABASE_URL` (porta 6543). A `DIRECT_URL` (porta 5432) é usada apenas para migrations.

```env
DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

---

## 3. Design system — SEGUIR RIGOROSAMENTE

### Paleta de cores

```
Navy (fundo principal):   #0D1B2A
Navy-mid (sidebar/cards): #162436
Navy-light (hover/elev.): #1E3045
Orange (CTA/highlight):   #F4631E
Orange-hover:             #E0551A
```

Texto:
- Títulos: `#FFFFFF`
- Corpo principal: `rgba(255,255,255,0.8)`
- Secundário: `rgba(255,255,255,0.4)`
- Bordas: `rgba(255,255,255,0.08)`

### Tipografia

```
Headings: Syne — weight 700 e 800  (font-family: "'Syne', sans-serif")
Body:     DM Sans — weight 300, 400 e 500
```

### Regras visuais

- Sem gradientes decorativos
- Bordas sempre `1px solid rgba(255,255,255,0.08)` em fundos navy
- Border-radius: `8px` (inputs/botões), `12px` (cards), `16px` (modais)
- Botão primário: fundo `#F4631E`, texto branco, font Syne semibold
- Inputs: fundo `rgba(255,255,255,0.05)`, foco `rgba(244,99,30,0.5)`
- Textura diagonal (usada em hero banners):
  `repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 20px)`
- Native `<select>` com `colorScheme: 'dark'` para evitar opções brancas no Windows
- Cores de avatar: hash do nome → índice em `AVATAR_PALETTE` (determinístico)
- **Cores sempre como `style` inline** — nunca classes Tailwind para valores do design system

### Layout de auth (login, cadastro)

Split 40/60:
- Esquerda (40%): fundo `#162436` — painel institucional com logo, headline
- Direita (60%): fundo `#0D1B2A` — formulário

### Logo

`CMLogo` (ícone play+scrubber SVG) + `CMLockup` (ícone + wordmark "CutMakers").
Variantes: `orange`, `navy`, `inverse`. Definidos em `packages/web/src/components/ui/CMLogo.tsx`.

---

## 4. Banco de dados — Schema (Prisma)

Localização: `packages/api/prisma/schema.prisma`

### Enums

```prisma
enum Role               { CREATOR EDITOR BOTH ADMIN }
enum OrderStatus        { PENDING ACCEPTED IN_PROGRESS DELIVERED REVISION_REQUESTED COMPLETED CANCELLED DISPUTED }
enum TransactionStatus  { PENDING HELD RELEASED REFUNDED }
enum SubscriptionStatus { ACTIVE EXPIRED CANCELLED }
enum RevisionStatus     { PENDING ADDRESSED }
enum NotificationType   { NEW_ORDER NEW_MESSAGE DELIVERY_RECEIVED REVISION_REQUESTED PAYMENT_RELEASED ORDER_ACCEPTED ORDER_CANCELLED }
```

### Modelos principais

| Modelo | Descrição |
|---|---|
| `User` | Usuário base. Roles: CREATOR, EDITOR, BOTH, ADMIN |
| `EditorProfile` | Perfil de editor (1:1 com User). `avgRating`, `totalJobs`, `isPremium` |
| `EditorCategory` | Relação N:N entre EditorProfile e Category |
| `Category` | Categorias de edição: Reels, YouTube, TikTok, Podcast, Corporativo, Wedding |
| `PortfolioItem` | Item do portfólio do editor. `videoUrl`, `thumbnailUrl`, `basePrice` |
| `Order` | Pedido de serviço. Liga creator + editor + category. Status controlado por `OrderStatus` |
| `OrderFile` | Arquivos de referência anexados à order |
| `Delivery` | Entrega do editor. `version` auto-incrementado. Transiciona order para DELIVERED |
| `Revision` | Revisão formal vinculada a uma Delivery (modelo pronto, não exposto ainda) |
| `Transaction` | Registro financeiro do pedido. `PENDING → HELD → RELEASED` |
| `Conversation` | Chat entre creator e editor. `orderId` é `@unique` (1 conversa por order) |
| `Message` | Mensagem dentro de uma Conversation. `readAt` nullable |
| `Review` | Avaliação do creator sobre o editor. `rating (1-5)`, `comment`. `orderId` é `@unique` |
| `Notification` | Notificações internas. Ligada a User e opcionalmente a uma Order |
| `Subscription` | Assinatura premium do editor (modelo pronto, não exposto ainda) |

---

## 5. Fluxo de autenticação

**Regra central: o role é identificado pelo backend no login. Nunca exibir seletor de role na tela de login.**

```
POST /auth/login
  → backend valida credenciais
  → retorna { token, refreshToken, user: { id, name, email, role, avatarUrl } }

Frontend lê user.role e redireciona:
  CREATOR → /dashboard/creator
  EDITOR  → /dashboard/editor
  BOTH    → exibe RoleSelectorModal (escolha Creator ou Editor)
  ADMIN   → /admin
```

- Tokens: JWT access token (15min) + refresh token (7d)
- Refresh via `POST /auth/refresh` — interceptor do axios faz isso automaticamente
- Admins criados apenas via seed (`pnpm --filter @cutmakers/api db:seed`), nunca por endpoint público

---

## 6. Estrutura de arquivos (estado atual)

```
cutmakers/
├── packages/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts              Admin + categorias
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── prisma.ts
│   │       │   ├── cloudinary.ts
│   │       │   └── errors.ts        NotFound, Forbidden, BadRequest
│   │       ├── middlewares/
│   │       │   ├── auth.middleware.ts   JWT → req.user.sub + req.user.role
│   │       │   ├── role.middleware.ts   requireRole(...)
│   │       │   └── error.middleware.ts
│   │       ├── services/
│   │       │   ├── auth.service.ts
│   │       │   ├── editor.service.ts
│   │       │   ├── portfolio.service.ts
│   │       │   ├── upload.service.ts
│   │       │   ├── order.service.ts
│   │       │   ├── payment.service.ts
│   │       │   ├── review.service.ts
│   │       │   └── conversation.service.ts
│   │       ├── controllers/
│   │       │   ├── auth.controller.ts
│   │       │   ├── editor.controller.ts
│   │       │   ├── portfolio.controller.ts
│   │       │   ├── upload.controller.ts
│   │       │   ├── order.controller.ts
│   │       │   ├── review.controller.ts
│   │       │   ├── conversation.controller.ts
│   │       │   └── webhook.controller.ts
│   │       ├── routes/
│   │       │   ├── index.ts
│   │       │   ├── auth.routes.ts
│   │       │   ├── editor.routes.ts
│   │       │   ├── category.routes.ts
│   │       │   ├── portfolio.routes.ts
│   │       │   ├── upload.routes.ts
│   │       │   ├── order.routes.ts
│   │       │   ├── conversation.routes.ts
│   │       │   └── webhook.routes.ts
│   │       ├── app.ts
│   │       └── index.ts
│   │
│   └── web/
│       └── src/
│           ├── components/
│           │   ├── layout/
│           │   │   └── DashboardShell.tsx   Sidebar + header reutilizável
│           │   ├── ui/
│           │   │   ├── CMLogo.tsx           CMLogo + CMLockup SVG
│           │   │   ├── Modal.tsx
│           │   │   ├── button.tsx
│           │   │   └── input.tsx
│           │   ├── orders/
│           │   │   ├── OrderCard.tsx        Card de resumo de pedido
│           │   │   ├── OrderDetail.tsx      Detalhe completo (usado inline nos dashboards)
│           │   │   └── NewOrderModal.tsx    Modal de criação de pedido
│           │   └── chat/
│           │       ├── ChatPanel.tsx        Widget de chat com polling 3s
│           │       └── MessagesTab.tsx      Lista de conversas + ChatPanel (tela completa)
│           ├── hooks/
│           │   ├── use-auth.ts
│           │   ├── use-categories.ts
│           │   ├── use-editor-me.ts
│           │   └── use-orders.ts
│           ├── lib/
│           │   ├── api.ts            Axios + interceptor de refresh token
│           │   ├── upload.ts         Upload signed para Cloudinary
│           │   ├── orders.ts         Tipos + API calls de orders
│           │   ├── reviews.ts        Tipos + API calls de reviews
│           │   └── conversations.ts  Tipos + API calls de conversas
│           └── pages/
│               ├── LandingPage.tsx
│               ├── LoginPage.tsx
│               ├── RegisterPage.tsx
│               ├── EditorPublicProfile.tsx
│               ├── admin/
│               │   └── AdminPage.tsx
│               ├── editor/
│               │   ├── EditorDashboard.tsx
│               │   └── components/
│               │       ├── PortfolioForm.tsx
│               │       └── ProfileForm.tsx
│               ├── creator/
│               │   └── CreatorDashboard.tsx
│               └── orders/
│                   └── OrderDetailPage.tsx   (thin shell — usa OrderDetail)
├── BRIEFING.md    ← este arquivo
├── CLAUDE.md
└── package.json
```

---

## 7. API — Endpoints completos

Base URL: `http://localhost:3333/api`

### Auth (`/auth`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/register` | — | `{ name, email, password, role: 'CREATOR'\|'EDITOR' }` |
| POST | `/login` | — | Retorna `{ token, refreshToken, user }` |
| POST | `/refresh` | — | Troca `refreshToken` por novo token |
| GET | `/me` | ✓ | Retorna usuário logado |

### Editores (`/editors`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/` | — | Lista pública com filtros: `?category=`, `?search=`, `?premium=true`, `?page=`, `?limit=` |
| GET | `/me` | EDITOR/BOTH | Perfil do editor logado |
| PATCH | `/me` | EDITOR/BOTH | Atualiza próprio perfil |
| GET | `/:id` | — | Perfil público completo do editor |
| GET | `/:id/reviews` | — | Avaliações paginadas do editor. `?page=`, `?limit=` |

### Portfólio (`/portfolio`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/` | — | Lista. Filtros: `?editor=userId`, `?category=catId` |
| GET | `/:id` | — | Item individual |
| POST | `/` | EDITOR/BOTH | Cria item |
| PATCH | `/:id` | EDITOR/BOTH/ADMIN | Atualiza (dono ou admin) |
| DELETE | `/:id` | EDITOR/BOTH/ADMIN | Remove (bloqueado se tem Orders vinculadas) |

### Categorias (`/categories`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/` | — | Lista todas as categorias |

### Uploads (`/uploads`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/signature` | ✓ | Gera assinatura para upload direto ao Cloudinary. Body: `{ folder: 'portfolio'\|'avatars'\|'orders'\|'deliveries', resourceType?: 'image'\|'video'\|'auto' }` |

### Orders (`/orders`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/` | ✓ | Lista. Filtros: `?role=creator\|editor`, `?status=`, `?page=`, `?limit=` |
| GET | `/:id` | ✓ | Detalhe completo (inclui deliveries, transaction, review) |
| POST | `/` | CREATOR/BOTH/ADMIN | Cria order com upload de arquivos |
| PATCH | `/:id/status` | ✓ | Atualiza status. Body: `{ status: OrderStatus }`. Validação por role (ver tabela abaixo) |
| POST | `/:id/deliveries` | EDITOR/BOTH/ADMIN | Editor envia entrega. Transiciona para DELIVERED automaticamente |
| POST | `/:id/payment` | CREATOR/BOTH/ADMIN | Inicia pagamento PIX via Abacatepay. Retorna `{ paymentUrl }` |
| POST | `/:id/review` | CREATOR/BOTH | Creator avalia o editor após COMPLETED |

### Conversas (`/conversations`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/` | ✓ | Lista todas as conversas do usuário logado |
| POST | `/order/:orderId` | ✓ | Cria ou retorna a conversa vinculada ao pedido |
| GET | `/:id/messages` | ✓ | Lista mensagens. Marca como lidas automaticamente. `?page=`, `?limit=` |
| POST | `/:id/messages` | ✓ | Envia mensagem. Body: `{ content: string }`. Cria notificação NEW_MESSAGE |

### Webhooks (`/webhooks`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/abacatepay` | HMAC | Recebe notificações do Abacatepay. `billing.paid` → Transaction HELD + notificação ao editor |

---

## 8. Fluxo de status de Orders

### Transições válidas por role

| De | Para | Quem pode |
|---|---|---|
| PENDING | ACCEPTED | editor, admin |
| PENDING | CANCELLED | creator, editor, admin |
| ACCEPTED | IN_PROGRESS | editor, admin |
| ACCEPTED | CANCELLED | creator, editor, admin |
| IN_PROGRESS | DELIVERED | admin *(normal flow via POST /deliveries)* |
| IN_PROGRESS | CANCELLED | admin |
| DELIVERED | COMPLETED | creator, admin |
| DELIVERED | REVISION_REQUESTED | creator, admin |
| REVISION_REQUESTED | IN_PROGRESS | editor, admin |
| COMPLETED | DISPUTED | admin |
| CANCELLED | DISPUTED | admin |
| DISPUTED | COMPLETED | admin |
| DISPUTED | CANCELLED | admin |

### Efeitos colaterais automáticos

- **COMPLETED** → `paymentService.releasePayment()` (Transaction HELD → RELEASED) + incrementa `EditorProfile.totalJobs`
- **POST /deliveries** → cria Delivery com `version` auto-incrementado + transiciona para DELIVERED + notificação DELIVERY_RECEIVED
- **POST /payment** → cria Transaction PENDING + cobrança PIX no Abacatepay
- **Webhook billing.paid** → Transaction PENDING → HELD + notificação ao editor
- Toda transição de status → notificação automática para a contraparte

---

## 9. Fluxo de pagamento (Abacatepay Escrow)

```
Creator clica "Pagar agora (PIX)"
  → POST /orders/:id/payment
  → Cria Transaction (PENDING) + cobrança no Abacatepay
  → Retorna paymentUrl → frontend abre no browser

Creator paga o PIX
  → Abacatepay dispara POST /webhooks/abacatepay
  → Valida HMAC-SHA256 (header x-abacatepay-signature)
  → Transaction PENDING → HELD
  → Notificação ao editor: pagamento recebido em escrow

Editor entrega o trabalho e creator aprova
  → PATCH /orders/:id/status { status: 'COMPLETED' }
  → Transaction HELD → RELEASED (pagamento liberado ao editor)
  → EditorProfile.totalJobs incrementado
```

Em ambiente de desenvolvimento sem `ABACATEPAY_API_KEY`: a Transaction é criada mas sem URL real de pagamento.

---

## 10. Sistema de Reviews

- Uma review por order (`orderId @unique`)
- Apenas o creator pode avaliar, apenas em orders `COMPLETED`
- `rating`: inteiro 1–5
- Após criar: `EditorProfile.avgRating` é recalculado via `prisma.$transaction`
- Endpoint público `GET /editors/:id/reviews` — exibe no perfil público do editor

---

## 11. Sistema de Chat (Mensagens)

- Uma `Conversation` por order (`orderId @unique`)
- Criada sob demanda em `POST /conversations/order/:orderId`
- Polling de 3s no frontend (`setInterval` com `clearInterval` no unmount)
- Mensagens marcadas como lidas ao buscar (`readAt` setado)
- Notificação `NEW_MESSAGE` criada a cada mensagem enviada

**Onde o chat aparece:**
- **Dashboards (Creator/Editor)** → seção "Mensagens": lista de conversas (esquerda) + `ChatPanel` (direita)
- **Detalhe do pedido** → widget colapsável "Mensagens" ao final do conteúdo esquerdo

---

## 12. Navegação e roteamento

```
/                         → LandingPage (pública)
/login                    → LoginPage
/register                 → RegisterPage
/dashboard/creator        → CreatorDashboard (CREATOR/BOTH/ADMIN)
/dashboard/editor         → EditorDashboard  (EDITOR/BOTH/ADMIN)
/admin                    → AdminPage        (ADMIN)
/editors/:id              → EditorPublicProfile (autenticado)
/orders/:id               → OrderDetailPage (autenticado — fallback para URL direta)
```

**Nota sobre /orders/:id**: acessar um pedido diretamente via URL funciona via `OrderDetailPage`. Porém dentro dos dashboards, clicar em um pedido abre o `OrderDetail` **inline** (sem navegar) — a sidebar permanece visível e o botão "Voltar" retorna à lista de pedidos.

---

## 13. Dashboards

### CreatorDashboard (`/dashboard/creator`)

Seções:
- **Buscar editores** — feed com busca + filtros por categoria + chips + ordenação
- **Meus pedidos** — lista de `OrderCard`. Clicar abre `OrderDetail` inline com sidebar visível
- **Mensagens** — `MessagesTab` (conversas + chat)
- **Favoritos / Pagamentos / Minha conta** — placeholders (Fase 5)

EditorCard: thumbnail 16:10 com textura diagonal, play button, badge, avatar colorido, min price, "Ver perfil →".

### EditorDashboard (`/dashboard/editor`)

Seções:
- **Dashboard** — stats: itens no portfólio, trabalhos concluídos, rating, status premium
- **Portfólio** — grid de items com editar/deletar. Upload via Cloudinary
- **Pedidos** — lista de `OrderCard`. Clicar abre `OrderDetail` inline com sidebar visível
- **Mensagens** — `MessagesTab`
- **Perfil** — `ProfileForm` para editar bio, avatar, categorias, preço

### AdminPage (`/admin`)

- Switcher de visão: Admin / Creator / Editor
- Tabelas de usuários, orders, transações

---

## 14. EditorPublicProfile (`/editors/:id`)

- Navbar própria (CMLockup + breadcrumb + bell + avatar do usuário logado)
- Hero banner com textura diagonal: avatar grande, badge PREMIUM, rating, preço mínimo
- Botão "Mensagem" (desabilitado — Fase 5 direct message)
- Botão "Contratar" → abre `NewOrderModal`
- Stats: totalJobs, avgRating, tempo médio (—), aprovação 1ª entrega (—)
- Portfólio com tabs por categoria + grid 4:3 com overlay
- Sidebar "Pacotes": 3 tiers derivados do portfólio (Express/Pro/Studio)
- Sidebar "Especialidades"
- Avaliações reais paginadas ("Ver mais" incremental), `ReviewCard` com avatar + estrelas + data relativa

---

## 15. Componentes reutilizáveis

| Componente | Localização | Descrição |
|---|---|---|
| `DashboardShell` | `components/layout/DashboardShell.tsx` | Sidebar + header. Props: `navItems`, `activeId`, `onNavigate`, `pageTitle`, `pageSubtitle`, `actions`, `badgeLabel`, `navLabel` |
| `CMLogo` / `CMLockup` | `components/ui/CMLogo.tsx` | Logo SVG. Variantes: `orange/navy/inverse` |
| `Modal` | `components/ui/Modal.tsx` | Modal genérico |
| `OrderCard` | `components/orders/OrderCard.tsx` | Card de resumo de pedido. Props: `order`, `perspective`, `onClick` |
| `OrderDetail` | `components/orders/OrderDetail.tsx` | Detalhe completo de pedido (stepper, ações, chat, review). Props: `orderId`, `onBack?` |
| `NewOrderModal` | `components/orders/NewOrderModal.tsx` | Modal de criação de pedido para um editor específico |
| `ChatPanel` | `components/chat/ChatPanel.tsx` | Widget de chat com polling. Props: `conversation`, `compact?` |
| `MessagesTab` | `components/chat/MessagesTab.tsx` | Lista de conversas + ChatPanel para seção de mensagens dos dashboards |

---

## 16. Variáveis de ambiente

```env
# packages/api/.env

# Banco (Supabase)
DATABASE_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Auth JWT
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3333
NODE_ENV=development

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Abacatepay (opcional em dev)
ABACATEPAY_API_KEY=...
ABACATEPAY_WEBHOOK_SECRET=...

# Frontend URL (usado no returnUrl do Abacatepay)
FRONTEND_URL=http://localhost:5173
```

---

## 17. Como rodar

```powershell
# Instalar dependências
pnpm install

# Configurar banco (primeira vez)
pnpm --filter @cutmakers/api db:push

# Seed (cria admin + categorias)
pnpm --filter @cutmakers/api db:seed

# Rodar em desenvolvimento
pnpm api    # backend na porta 3333
pnpm web    # frontend na porta 5173
```

### Credenciais admin (criadas pelo seed)

```
Email: cutmakers@admin.com
Senha: cutmakers@123
```

---

## 18. Progresso das fases

```
✅ Fase 1 — Base
   [x] Monorepo pnpm workspaces
   [x] API Express + TypeScript + Prisma
   [x] Schema completo (15 modelos)
   [x] Auth: register, login, refresh, JWT middleware
   [x] Seed: admin + categorias
   [x] Frontend: Login, Register, AdminPage

✅ Fase 2 — Core Editor
   [x] CRUD EditorProfile + requireRole middleware
   [x] Upload signed Cloudinary (portfolio, avatars, orders, deliveries)
   [x] CRUD PortfolioItem com ownership check
   [x] Listagem pública de editores com filtros
   [x] EditorDashboard (overview + portfólio + pedidos + perfil + mensagens)
   [x] CreatorDashboard (busca + filtros + chips + ordenação + pedidos + mensagens)
   [x] EditorPublicProfile redesenhado

✅ Fase 3 — Core Creator + Pagamentos
   [x] Criar Order com upload de OrderFile
   [x] Fluxo de status com transições validadas por role
   [x] Notificações automáticas em cada transição
   [x] Envio de entregas pelo editor (upload Cloudinary, versionamento automático)
   [x] Integração Abacatepay: PIX escrow + webhook de confirmação
   [x] OrderDetail: stepper, ações contextuais, histórico de entregas, sidebar financeiro, chat inline

✅ Fase 3.5 — Design System (Landing + UI)
   [x] LandingPage pública completa (Nav, Hero, HowItWorks, Categorias, Editores, Stats, CTA, Footer)
   [x] CMLogo/CMLockup SVG
   [x] DashboardShell reutilizável com sidebar, active state laranja, navLabel
   [x] EditorCard redesenhado (thumbnail 16:10, diagonal texture, play, badge, avatar colorido)
   [x] Filtros e chips no feed de editores

✅ Fase 3.6 — Reviews/Ratings
   [x] ReviewService: createReview + getEditorReviews
   [x] Recalcula EditorProfile.avgRating via prisma.$transaction
   [x] Incrementa EditorProfile.totalJobs no COMPLETED
   [x] ReviewFormSection no OrderDetail (StarRating interativo)
   [x] Avaliações exibidas no EditorPublicProfile (paginadas, "Ver mais")
   [x] Endpoints: POST /orders/:id/review, GET /editors/:id/reviews

✅ Fase 4 — Chat/Mensagens
   [x] ConversationService: getOrCreateByOrder, listForUser, getMessages, sendMessage
   [x] Auto-read ao buscar mensagens (readAt setado)
   [x] Notificação NEW_MESSAGE a cada mensagem
   [x] ChatPanel com polling 3s, bolhas orange/dark, auto-scroll, Enter para enviar
   [x] MessagesTab: lista 300px à esquerda + ChatPanel à direita
   [x] Mensagens no EditorDashboard e CreatorDashboard
   [x] Widget de chat colapsável no OrderDetail

✅ Fase 4.1 — OrderDetail inline nos dashboards
   [x] OrderDetail extraído como componente reutilizável
   [x] Clicar em pedido abre OrderDetail inline (sidebar permanece visível)
   [x] Botão "Voltar" retorna à lista sem navegação de página

⏳ Fase 5 — Polish (próxima)
   [ ] Edição de pedido enquanto PENDING (backend PATCH /orders/:id + frontend)
   [ ] Mensagem direta entre creator e editor (sem order vinculada)
   [ ] Notifications bell: listagem + marcar como lido
   [ ] Subscription premium do editor
   [ ] Endpoints admin avançados (aprovar editores, resolver disputas)
   [ ] Revision formal (modelo já existe no schema — expor via API)
```

---

## 19. Regras que nunca devem ser quebradas

- ❌ Adicionar seletor de role na tela de login
- ❌ Criar endpoint público de criação de admin
- ❌ Usar Supabase Auth ou Supabase Storage
- ❌ Subir vídeos/arquivos pelo servidor (sempre signed upload direto ao Cloudinary)
- ❌ Retornar `passwordHash` em qualquer DTO
- ❌ Commitar `.env`
- ❌ Quebrar a paleta de cores ou trocar as fontes
- ❌ Usar `req.user.id` nos controllers — o JWT armazena o userId em `req.user.sub`
- ❌ Usar `req.params.x` sem `as string` — Express tipou params como `string | string[]`
