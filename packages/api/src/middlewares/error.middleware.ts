import { Request, Response, NextFunction } from 'express'
import { HttpError } from '../lib/errors'

export function errorMiddleware(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message })
  }

  console.error('[unhandled]', err.stack ?? err)
  return res.status(500).json({ message: 'Erro interno do servidor' })
}
