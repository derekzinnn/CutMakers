# Deploy — CutMakers (produção / staging público)

Guia para publicar o CutMakers em `https://cutmakers.derek.dev.br` no VPS
(OCI ARM Ubuntu, Docker Compose, Caddy central em `~/infra/`).

O objetivo principal deste ambiente é ter uma **URL HTTPS pública** para testar o
**webhook do Abacatepay** (`billing.paid`), que não funciona em localhost.

---

## Arquitetura

```
Internet ──HTTPS──▶ Caddy (~/infra/, rede `web`)
                        │
        ┌───────────────┴───────────────┐
        │ /api/*                         │ resto
        ▼                                ▼
  cutmakers-api:3333              cutmakers-web:80 (nginx, SPA)
  (Express + Prisma)                     
        │
        ▼
  Supabase (Postgres gerenciado — externo, sem container de banco)
```

- O SPA chama a API por caminho **relativo** `/api`; o Caddy roteia `/api/*` para a API.
- Sem container de banco — usamos **Supabase**.
- Ambos os serviços entram na rede externa **`web`** (a mesma dos outros projetos).

---

## Arquivos desta entrega

| Arquivo | Papel |
|---|---|
| `packages/api/Dockerfile` | Imagem de produção da API (multi-stage, non-root) |
| `packages/web/Dockerfile` | Build Vite + nginx servindo o SPA |
| `packages/web/nginx.conf` | Config nginx (fallback SPA) |
| `docker-compose.yml` | Serviços `cutmakers-api` e `cutmakers-web` na rede `web` |
| `deploy/cutmakers.Caddyfile` | Bloco a colar no Caddyfile central |
| `.env.production.example` | Modelo das variáveis de produção |
| `.dockerignore` | Mantém o contexto de build enxuto / sem segredos |
| `prisma/migrations/0_init` | Migration baseline (todo o schema atual) |

---

## Pré-requisitos no VPS

- Docker + Docker Compose v2
- Caddy central rodando em `~/infra/` na rede `web`
- A rede externa `web` existe (se não: `docker network create web`)
- DNS: `cutmakers.derek.dev.br` apontando para o IP do VPS (registro A/AAAA)

---

## Passo 1 — Código no servidor

Faça `git clone`/`git pull` do repositório no VPS (o build precisa do contexto completo).
**Recomendado buildar no próprio VPS (ARM)** para o engine nativo do Prisma casar com a
plataforma de runtime.

```bash
cd ~/infra   # ou onde você organiza os projetos
git clone <repo> cutmakers && cd cutmakers
# ou: cd cutmakers && git pull
```

## Passo 2 — Variáveis de produção

```bash
cp .env.production.example packages/api/.env.production
nano packages/api/.env.production
```

Preencha com atenção:

- **`JWT_SECRET` / `JWT_REFRESH_SECRET`** — gere NOVOS, nunca reutilize os de dev:
  ```bash
  openssl rand -base64 48   # rode 2x, um para cada
  ```
- **`DATABASE_URL` / `DIRECT_URL`** — Supabase. Decida:
  - **Projeto novo de produção** (recomendado) — isola dos dados de teste; ou
  - **Reutilizar o de dev** — mais rápido para só testar o webhook (ver Passo 4, caso B).
- **`CORS_ORIGIN=https://cutmakers.derek.dev.br`**
- **`FRONTEND_URL=https://cutmakers.derek.dev.br`**
- `CLOUDINARY_*`, `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET`.

> O frontend usa `/api` relativo, então **não é preciso** definir `VITE_API_URL`.

## Passo 3 — Build das imagens

```bash
docker compose build
```

## Passo 4 — Migrations do banco (Prisma)

### `db push` vs `migrate deploy` — a diferença

- **`prisma db push`** (usado em dev até aqui): empurra o schema direto pro banco, **sem
  histórico** de migrations. Ótimo para prototipar, mas pode causar perda de dados e não é
  reproduzível — **não usar em produção**.
- **`prisma migrate deploy`** (produção): aplica, em ordem, os arquivos de migration
  **versionados no git** (`prisma/migrations/`), registrando cada um em `_prisma_migrations`.
  Reproduzível e seguro. É o comando do fluxo de deploy.

Já existe a migration baseline `prisma/migrations/0_init` (todo o schema atual).

### Caso A — banco de produção NOVO (vazio)

```bash
docker compose run --rm cutmakers-api npx prisma migrate deploy
```

Isso cria todas as tabelas/enums a partir do `0_init`.

### Caso B — reutilizando o banco de DEV (já tem as tabelas via `db push`)

O banco já está com o schema, mas sem histórico de migrations. **Baseline** a migration
existente (marca como aplicada sem re-executar), senão o `deploy` tentaria recriar tabelas:

```bash
docker compose run --rm cutmakers-api npx prisma migrate resolve --applied 0_init
```

Migrations futuras (novas) seguem via `npx prisma migrate deploy` normalmente.

> `migrate deploy`/`resolve` usam a `DIRECT_URL` (porta 5432) do `.env.production`.

## Passo 5 — Subir os containers

```bash
docker compose up -d
docker compose ps
docker compose logs -f cutmakers-api   # confirme "CutMakers API rodando..."
```

## Passo 6 — Caddy

Cole o bloco de `deploy/cutmakers.Caddyfile` no seu Caddyfile central (`~/infra/`) e recarregue
sem downtime:

```bash
# ajuste caminho/serviço conforme seu setup do Caddy
docker exec -w /etc/caddy <caddy-container> caddy reload
# ou, se o Caddy roda fora de container:
sudo systemctl reload caddy
```

Aguarde a emissão do certificado (segundos) e teste:

```bash
curl -s https://cutmakers.derek.dev.br/api/health   # {"status":"ok"}
```

## Passo 7 — Webhook do Abacatepay

No painel do Abacatepay, aponte a URL de webhook para:

```
https://cutmakers.derek.dev.br/api/webhooks/abacatepay
```

Garanta que o `ABACATEPAY_WEBHOOK_SECRET` no painel é o mesmo do `.env.production`
(a API valida a assinatura HMAC-SHA256 no header `x-abacatepay-signature`).

Teste ponta a ponta: assine o Premium / pague um pedido → o Abacatepay dispara
`billing.paid` → a API confirma (Transaction→HELD ou assinatura→ACTIVE).

---

## Logs

```bash
docker compose logs -f cutmakers-api
docker compose logs -f cutmakers-web
docker compose ps          # inclui status do healthcheck (healthy/unhealthy)
```

## Rollback

**Aplicação** (imagem anterior):

```bash
# antes de rebuildar, marque a imagem atual boa:
docker tag cutmakers-api:latest cutmakers-api:prev
docker tag cutmakers-web:latest cutmakers-web:prev

# se um deploy novo quebrar, volte:
docker tag cutmakers-api:prev cutmakers-api:latest
docker tag cutmakers-web:prev cutmakers-web:latest
docker compose up -d
```

Ou volte o código e rebuilde:

```bash
git checkout <commit-anterior>
docker compose build && docker compose up -d
```

**Banco:** migrations não têm "down" automático. Para reverter o schema, restaure um
**backup do Supabase** (painel do Supabase) e/ou escreva uma nova migration corretiva.
Por isso: faça backup/snapshot no Supabase antes de rodar `migrate deploy` em dados reais.

## Parar / atualizar

```bash
docker compose down            # para (mantém imagens)
git pull && docker compose build && docker compose up -d   # atualizar
```

---

## Alternativa: buildar localmente e transferir (sem buildar no VPS)

Só se você buildar numa máquina ARM64 (senão o engine do Prisma não casa):

```bash
docker save cutmakers-api:latest cutmakers-web:latest | gzip | \
  ssh vps 'gunzip | docker load'
# no VPS: rode Passos 4–6 (migrations, up, Caddy)
```

Se buildar em arquitetura diferente do VPS, adicione o alvo ARM ao Prisma em
`packages/api/prisma/schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-arm64-openssl-3.0.x"]
}
```
