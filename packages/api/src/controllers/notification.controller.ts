import { Request, Response, NextFunction } from 'express'
import { notificationService } from '../services/notification.service'

export const notificationController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.sub
      const [notifications, unreadCount] = await Promise.all([
        notificationService.listForUser(userId),
        notificationService.countUnread(userId),
      ])
      res.json({ notifications, unreadCount })
    } catch (err) {
      next(err)
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationService.markAllRead(req.user!.sub)
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  },

  async markOneRead(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationService.markOneRead(req.params.id as string, req.user!.sub)
      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  },
}
