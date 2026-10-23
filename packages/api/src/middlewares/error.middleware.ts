import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { HttpError } from '../lib/errors'

export function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message })
  }

  // Entrada inválida (query/body que não passou no Zod) é erro do cliente, não do servidor
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Parâmetros inválidos', issues: err.issues.map((i) => i.path.join('.')) })
  }

  console.error('[unhandled]', err.stack ?? err)
  return res.status(500).json({ message: 'Erro interno do servidor' })
}
