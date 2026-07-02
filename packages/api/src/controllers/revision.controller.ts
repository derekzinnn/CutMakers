import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { revisionService } from '../services/revision.service'

const createSchema = z.object({
  deliveryId: z.string().uuid('deliveryId inválido'),
  description: z.string().min(1, 'Descreva o que precisa ser alterado').max(2000),
})

export const revisionController = {
  // POST /api/orders/:id/revisions
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createSchema.parse(req.body)
      const revision = await revisionService.createRevision(req.params.id as string, req.user!.sub, body)
      res.status(201).json({ revision })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/orders/:id/revisions
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const revisions = await revisionService.listRevisions(
        req.params.id as string,
        req.user!.sub,
        req.user!.role === 'ADMIN',
      )
      res.json({ revisions })
    } catch (err) {
      next(err)
    }
  },
}
