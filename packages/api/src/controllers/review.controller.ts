import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { reviewService } from '../services/review.service'

const createSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
})

export const reviewController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = createSchema.parse(req.body)
      const review = await reviewService.createReview(req.params.id as string, req.user!.sub, body)
      res.status(201).json({ review })
    } catch (err) {
      next(err)
    }
  },

  async listForEditor(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1
      const limit = Number(req.query.limit) || 10
      const result = await reviewService.getEditorReviews(req.params.id as string, { page, limit })
      res.json(result)
    } catch (err) {
      next(err)
    }
  },
}
