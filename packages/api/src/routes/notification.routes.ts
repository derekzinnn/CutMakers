import { Router } from 'express'
import { notificationController } from '../controllers/notification.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

export const notificationRoutes = Router()

notificationRoutes.use(authMiddleware)

notificationRoutes.get('/', notificationController.list)
notificationRoutes.patch('/read-all', notificationController.markAllRead)
notificationRoutes.patch('/:id/read', notificationController.markOneRead)
