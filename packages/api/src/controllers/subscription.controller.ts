import type { Request, Response, NextFunction } from 'express'
import { subscriptionService } from '../services/subscription.service'

export const subscriptionController = {
  // POST /api/subscriptions  (EDITOR/BOTH)
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.createSubscription(req.user!.sub)
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  },

  // GET /api/subscriptions/me  (EDITOR/BOTH)
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const subscription = await subscriptionService.getMySubscription(req.user!.sub)
      res.json(subscription)
    } catch (err) {
      next(err)
    }
  },
}
