import { Request, Response, NextFunction } from 'express'
import { Role } from '@prisma/client'

/**
 * Middleware factory que restringe uma rota a roles específicas.
 * Deve ser usado APÓS o authMiddleware (depende de req.user).
 *
 * @example
 *   router.patch('/me', authMiddleware, requireRole('EDITOR', 'BOTH'), ctrl.updateMe)
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado' })
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      return res.status(403).json({
        message: 'Acesso negado para esta role',
        required: allowedRoles,
        current: req.user.role,
      })
    }

    next()
  }
}
