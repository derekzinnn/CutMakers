import type { Request, Response, NextFunction } from 'express'

/**
 * Headers de segurança básicos (subconjunto do que o helmet faz, sem dependência nova).
 * A API só devolve JSON, então a CSP pode ser a mais restritiva possível.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  res.removeHeader('X-Powered-By')
  // HSTS só faz sentido sobre HTTPS (produção atrás do proxy)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
}
