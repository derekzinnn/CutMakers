import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { disputeService } from '../services/dispute.service'

const openSchema = z.object({
  reason: z.string().min(1, 'Descreva o motivo da disputa').max(2000),
})

const resolveSchema = z.object({
  resolution: z.enum(['RELEASE', 'REFUND']),
})

export const disputeController = {
  // POST /api/orders/:id/dispute
  async open(req: Request, res: Response, next: NextFunction) {
    try {
      const body = openSchema.parse(req.body)
      const dispute = await disputeService.openDispute(req.params.id as string, req.user!.sub, body.reason)
      res.status(201).json({ dispute })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/orders/:id/dispute/resolve  (ADMIN only)
  async resolve(req: Request, res: Response, next: NextFunction) {
    try {
      const body = resolveSchema.parse(req.body)
      const dispute = await disputeService.resolveDispute(req.params.id as string, req.user!.sub, body.resolution)
      res.json({ dispute })
    } catch (err) {
      next(err)
    }
  },
}
