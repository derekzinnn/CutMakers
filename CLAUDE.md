# CutMakers — Contexto do projeto

> Este arquivo é lido automaticamente pelo Claude Code ao abrir o repositório.
> Mantém o assistente alinhado com o que já foi decidido e construído.

---

## 🎯 O que é o CutMakers

Marketplace que conecta **criadores de conteúdo** (influenciadores) a **editores freelancers** de vídeo. Funciona como um Fiverr focado exclusivamente em edição de vídeo, com escrow de pagamento e sistema de portfólio.

**Monetização:** taxa sobre cada trabalho concluído + assinatura premium para editores.

**Briefing completo:** Ver `BRIEFING.md` na raiz (se presente) ou `C:\Users\derek\Downloads\BRIEFING.md`.

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
│           │   ├── layout/   DashboardShell
│           │   └── ui/       Button, Input, Modal
│           ├── hooks/        use-auth, use-categories, use-editor-me
│           ├── lib/          api (axios), upload (cloudinary), utils
│           └── pages/
│               ├── admin/    AdminPage
│               ├── editor/   EditorDashboard + components
│               ├── creator/  CreatorDashboard
│               ├── LoginPage, RegisterPage, EditorPublicProfile
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

---

## 📊 Progresso

```
✅ Fase 1 — Base
   [x] Monorepo pnpm workspaces
   [x] API Express + TypeScript + Prisma
   [x] Schema Prisma completo (15 modelos)
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

⏳ Fase 3 — Core Creator (PRÓXIMA)
   [ ] Criar Order com upload de OrderFile
   [ ] Fluxo de status da Order (PENDING → ACCEPTED → ...)
   [ ] Integração Abacatepay (escrow)

⏳ Fase 4 — Comunicação
   [ ] Conversation + Message
   [ ] Delivery + Revision
   [ ] Liberação de pagamento ao aprovar

⏳ Fase 5 — Polish
   [ ] Notifications
   [ ] Review/Rating
   [ ] Subscription premium do editor
   [ ] Endpoints admin avançados
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
