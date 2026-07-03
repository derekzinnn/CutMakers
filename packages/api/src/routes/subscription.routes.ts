import { Router } from 'express'
import { subscriptionController } from '../controllers/subscription.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

export const subscriptionRoutes: Router = Router()

subscriptionRoutes.use(authMiddleware)

// Apenas editores (ou BOTH) assinam / consultam o premium
subscriptionRoutes.post('/', requireRole('EDITOR', 'BOTH'), subscriptionController.create)
subscriptionRoutes.get('/me', requireRole('EDITOR', 'BOTH'), subscriptionController.me)
