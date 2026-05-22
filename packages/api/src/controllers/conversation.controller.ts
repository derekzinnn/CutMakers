import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { conversationService } from '../services/conversation.service'

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
})

export const conversationController = {
  async getOrCreateByOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await conversationService.getOrCreateByOrder(
        req.params.orderId as string,
        req.user!.sub,
      )
      res.json({ conversation })
    } catch (err) {
      next(err)
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const conversations = await conversationService.listForUser(req.user!.sub)
      res.json({ conversations })
    } catch (err) {
      next(err)
    }
  },

  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1
      const limit = Math.min(Number(req.query.limit) || 50, 100)
      const messages = await conversationService.getMessages(
        req.params.id as string,
        req.user!.sub,
        page,
        limit,
      )
      res.json({ messages })
    } catch (err) {
      next(err)
    }
  },

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { content } = sendMessageSchema.parse(req.body)
      const message = await conversationService.sendMessage(
        req.params.id as string,
        req.user!.sub,
        content,
      )
      res.status(201).json({ message })
    } catch (err) {
      next(err)
    }
  },
}
