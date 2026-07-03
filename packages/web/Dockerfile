# CutMakers Web — imagem de produção (build Vite + nginx estático)

# ── Build: compila o SPA com Vite ─────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
RUN npm install -g pnpm@9
WORKDIR /app

# Manifests primeiro (cache + validação do lockfile congelado)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/api/package.json packages/api/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile --filter @cutmakers/web...

COPY packages/web ./packages/web

# IMPORTANTE: variáveis VITE_* são "assadas" no bundle em BUILD TIME.
# O app atual usa baseURL relativa ('/api'), então VITE_API_URL é OPCIONAL
# (mantido aqui para caso futuramente se aponte para uma API em outro domínio).
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @cutmakers/web build

# ── Runtime: nginx servindo os estáticos ──────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
