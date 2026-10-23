import type { Request, Response, NextFunction, RequestHandler } from 'express'

// ─── Rate limiting (janela fixa, em memória) ───────────────────────────────────
// Protege as rotas de autenticação contra força bruta e abuso de cadastro.
// Em memória de propósito: a API roda em uma única instância e isso evita
// dependência nova. Reinicia a contagem quando o processo reinicia — aceitável
// para brute-force (o atacante não escolhe quando o servidor reinicia). Se um dia
// houver mais de uma instância, trocar o Map por Redis mantendo a mesma interface.

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimitOptions {
  /** Prefixo da chave — separa o contador de cada rota */
  name: string
  /** Janela em milissegundos */
  windowMs: number
  /** Máximo de requisições por chave dentro da janela */
  max: number
  /** Deriva a chave (padrão: IP). Retornar null ignora o limite para essa request */
  key?: (req: Request) => string | null
  message?: string
}

const buckets = new Map<string, Bucket>()

// Limpeza periódica para o Map não crescer sem limite. unref(): não segura o processo vivo.
const sweep = setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
}, 60_000)
sweep.unref()

/** Desligado em testes (NODE_ENV=test) ou explicitamente com RATE_LIMIT_DISABLED=true */
function disabled(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.RATE_LIMIT_DISABLED === 'true'
}

export function clientIp(req: Request): string {
  // Com `trust proxy` configurado no app, req.ip já é o IP real (X-Forwarded-For do Caddy)
  return req.ip ?? req.socket.remoteAddress ?? 'unknown'
}

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const message = opts.message ?? 'Muitas tentativas. Aguarde um instante e tente novamente.'

  return (req: Request, res: Response, next: NextFunction) => {
    if (disabled()) return next()

    const id = (opts.key ?? clientIp)(req)
    if (id === null) return next()

    const key = `${opts.name}:${id}`
    const now = Date.now()
    let bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs }
      buckets.set(key, bucket)
    }

    bucket.count++
    const remaining = Math.max(opts.max - bucket.count, 0)
    res.setHeader('RateLimit-Limit', String(opts.max))
    res.setHeader('RateLimit-Remaining', String(remaining))

    if (bucket.count > opts.max) {
      const retryAfter = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1)
      res.setHeader('Retry-After', String(retryAfter))
      return res.status(429).json({ message })
    }
    next()
  }
}

/** Só para testes: zera todos os contadores */
export function resetRateLimits(): void {
  buckets.clear()
}
