import type { Request, Response, NextFunction } from 'express'
import { agreementService } from '../services/agreement.service'

export const agreementController = {
  // POST /api/orders/:id/agreement/accept — registra o aceite da parte logada
  async accept(req: Request, res: Response, next: NextFunction) {
    try {
      const agreement = await agreementService.acceptAgreement(req.params.id as string, req.user!.sub)
      res.json({ agreement })
    } catch (err) {
      next(err)
    }
  },
}
