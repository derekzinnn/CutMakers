import { Router } from 'express'
import { conversationController } from '../controllers/conversation.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

export const conversationRoutes: Router = Router()

conversationRoutes.use(authMiddleware)

// Get or create conversation tied to an order
conversationRoutes.post('/order/:orderId', conversationController.getOrCreateByOrder)

// List all conversations for the authenticated user
conversationRoutes.get('/', conversationController.list)

// Get messages for a conversation
conversationRoutes.get('/:id/messages', conversationController.getMessages)

// Send a message to a conversation
conversationRoutes.post('/:id/messages', conversationController.sendMessage)
