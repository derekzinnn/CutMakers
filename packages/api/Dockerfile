# CutMakers API — imagem de produção (multi-stage)
# Build recomendado NO PRÓPRIO VPS ARM (OCI Ubuntu ARM64) para que o engine
# nativo do Prisma case com a plataforma de runtime.

# ── Base: Node 22 + pnpm ──────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ── Build: instala deps, gera Prisma Client, compila TypeScript ───────────────
FROM base AS build
# Manifests primeiro (melhor cache de camadas). Todos os package.json do workspace
# são necessários para o pnpm validar o lockfile congelado.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile --filter @cutmakers/api...

# Código-fonte da API
COPY packages/api ./packages/api

RUN pnpm --filter @cutmakers/api exec prisma generate
RUN pnpm --filter @cutmakers/api build

# Gera um diretório self-contained só com dependências de produção
RUN pnpm deploy --filter=@cutmakers/api --prod /prod/api
# Regenera o Prisma Client dentro do node_modules achatado do deploy
RUN cd /prod/api && npx prisma generate

# ── Runtime: apenas dist + deps de produção, usuário non-root ─────────────────
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
# O engine do Prisma precisa de openssl em runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# Usuário sem privilégios
RUN groupadd --system app && useradd --system --gid app --home-dir /app app
WORKDIR /app
COPY --from=build --chown=app:app /prod/api ./
USER app
EXPOSE 3333
# Healthcheck é feito pelo docker-compose contra GET /health
CMD ["node", "dist/index.js"]
