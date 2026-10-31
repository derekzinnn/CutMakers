# CutMakers

## Visão geral

- **O que é:** marketplace que conecta **criadores de conteúdo** a **editores de vídeo freelancers** —
  um "Fiverr de edição de vídeo" com escrow de pagamento, portfólio e marketplace invertido
  (editor envia proposta para a solicitação do criador).
- **Monetização:** taxa sobre cada trabalho concluído + assinatura Premium do editor (R$ 39,90/mês).
- **Área:** universidade (projeto da faculdade) · **Repo:** `derekzinnn/CutMakers`
- Briefing de produto completo: `BRIEFING.md`.

## Stack

- pnpm workspaces: `packages/api` (Node + Express + TypeScript + Prisma) e `packages/web`
  (React 18 + Vite + shadcn/ui + Tailwind v3) · Mobile React Native: futuro
- Banco: Supabase PostgreSQL via Prisma (pooler `?pgbouncer=true` 6543 + `DIRECT_URL` 5432)
- Upload: Cloudinary (upload assinado direto do front) · Pagamentos: AbacatePay **v2** (PIX + assinatura)
- Ícones Tabler (outline) · Fontes Noto Sans + Nunito Sans (preset shadcn `bfDpIkWg4`) · Testes: Vitest

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm install` | instala |
| `pnpm --filter @cutmakers/api db:push` · `db:seed` | banco (1ª vez) e seed (admin + categorias) |
| `pnpm api` · `pnpm web` | backend :3333 · frontend :5173 |
| `pnpm jobs` | jobs agendados (expirar assinaturas, auto-aprovar entregas) — cron de 15 min na VPS |
| `pnpm demo:seed` · `demo:reset` · `demo:remove` | dados de demonstração (`@demo.cutmakers`) |

Admin do seed: `cutmakers@admin.com` (senha no seed — só para dev). Variáveis: `packages/api/.env.example`.
Sem `ABACATEPAY_API_KEY` o sistema roda em **modo demonstração** (pagamento simulado, faixa na UI).

## Arquitetura

```
packages/api/src   lib/ (prisma, cloudinary, errors, abacatepay) · middlewares/ (auth, role, error)
                   services/ · controllers/ · routes/ · app.ts
packages/web/src   components/{layout/DashboardShell, ui/} · hooks/ (use-cached, use-auth…) · lib/api.ts · pages/
```

- Fluxo de pedido com status, contrato por pedido (aceite eletrônico), revisões, disputas, chat, notificações,
  auditoria e painel admin (ver endpoints no contexto completo).
- Backend: `HttpError` + `errorMiddleware`; DTOs nos services (nunca `passwordHash`, `Decimal`→`Number`);
  Zod nos controllers; transactions em operações compostas.
- Frontend: busca de dados **sempre com `useCached`** (nunca `useState`+`useEffect`); toda escrita invalida
  as chaves relacionadas; carregando = **skeleton, nunca spinner**.

## Regras do projeto (NÃO fazer)

- ❌ Seletor de role na tela de login · ❌ endpoint público de criação de admin (admins só via seed)
- ❌ Supabase Auth ou Storage (JWT próprio; uploads só Cloudinary) · ❌ vídeo passando pelo servidor
- ❌ `passwordHash` em DTO · ❌ commitar `.env` · ❌ hex cru (só tokens `var(--card)`, `bg-brand`…)
- ❌ cores/fontes antigas (#0D1B2A, #162436, #F4631E, Syne/DM Sans) · ❌ `bg-input/40` em token oklch
- ❌ Docker/Caddy/Compose no repo — deploy é manual do Derek
- Integridade acadêmica: o Derek precisa entender e defender todo o código — explicar o porquê do que for gerado.

## Fases

Legenda: ✅ concluída · 🟡 em andamento · ⏳ próxima · 💤 backlog

| # | Fase | Status |
|---|---|---|
| 1–3.6 | Base, núcleo do editor, núcleo do criador, design system, avaliações | ✅ |
| 4.x–7 | Negociação + payment gate, chat, notificações, revisões/disputas, Premium, admin avançado | ✅ |
| 8–12 | Preparo p/ produção, UX/performance, contratos/termos, auditoria, marketplace invertido | ✅ |
| 13–18 | Hardening de segurança, testes (unidade + integração), migrations, Premium real, "ver como", cache/paginação | ✅ |
| 14 (cont.) | CI, cron real, modo demonstração, Google login (gated), favoritos, conta do criador, AbacatePay v2 | ✅ |
| 24, 26 | Dashboard admin com período comparado · personas do admin no "ver como" (citadas no código; sem bloco no log) | ✅ |
| — | PIX do pedido validado no sandbox (chave sem `TRANSPARENT:CREATE/READ`) | ⏳ precisa de chave nova |
| — | Repasse real ao editor e estorno (escrow hoje é só contábil) | ⏳ decisão de produto |
| — | Disputa pós-conclusão (quem absorve o estorno, janela de contestação) | ⏳ decisão de negócio |
| — | App mobile React Native | 💤 |

**Próximo passo imediato:** decisões do Derek — gerar chave AbacatePay com permissões de PIX e definir
a política de repasse/estorno. Em produção, coletar CPF/telefone reais (hoje usa `ABACATEPAY_FALLBACK_*`).
Pendente local: pasta `memory/` não versionada — decidir se vai para o git.

## Log de decisões

Formato: `AAAA-MM-DD — decisão — motivo` (mais recente no topo). Histórico completo em `docs/contexto-completo.md` → "Progresso".

- 2026-10-31 — CLAUDE.md enxugado; original (981 linhas) movido com `git mv` para `docs/contexto-completo.md` — reduzir contexto por sessão.
- Migração AbacatePay v1 → v2 (v1 sai do ar); PIX transparente por pedido (checkout v2 não aceita valor dinâmico).
- Admin lê a conversa do pedido (mediação) mas não envia — mensagem de admin viraria prova na disputa que ele julga.
- Selo "verificado" curado pelo admin (`EditorProfile.verified`) — antes aparecia para todos (badge falso).

## Documentação detalhada (ler sob demanda)

`docs/contexto-completo.md`: endpoints da API (auth, orders, agreements, revisions, disputes, webhooks,
subscriptions, requests, admin…) · design system e tokens · progresso detalhado por fase · convenções completas.
`BRIEFING.md`: produto, público, regras de negócio.
