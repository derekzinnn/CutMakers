import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth.service'
import { readOnlyWhenImpersonating } from './impersonation.middleware'

const authService = new AuthService()

declare global {
  namespace Express {
    interface Request {
      user?: { sub: string; role: string; imp?: { by: string } }
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não fornecido' })
  }

  const token = authHeader.split(' ')[1]

  try {
    const payload = authService.verifyToken(token)
    req.user = payload
    // Encadeado AQUI e nao em app.use(): o guard depende de req.user, e o
    // authMiddleware e o unico ponto por onde toda request autenticada passa.
    // Assim nenhuma rota nova nasce desprotegida por esquecimento.
    return readOnlyWhenImpersonating(req, res, next)
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado' })
  }
}
