import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { paymentService } from '../services/payment.service'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

export const paymentRoutes: Router = Router()

const meQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
})

// GET /api/payments/me — histórico de pagamentos do creator logado
paymentRoutes.get(
  '/me',
  authMiddleware,
  requireRole('CREATOR', 'BOTH', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = meQuery.parse(req.query)
      res.json(await paymentService.getMyPayments(req.user!.sub, query.page))
    } catch (err) {
      next(err)
    }
  },
)
