import { Request, Response, NextFunction } from 'express'
import { AuthService } from '../services/auth.service'

const authService = new AuthService()

declare global {
  namespace Express {
    interface Request {
      user?: { sub: string; role: string }
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
    next()
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado' })
  }
}
