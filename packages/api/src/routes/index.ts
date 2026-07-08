import { Router } from 'express'
import { authRoutes } from './auth.routes'
import { editorRoutes } from './editor.routes'
import { categoryRoutes } from './category.routes'
import { portfolioRoutes } from './portfolio.routes'
import { uploadRoutes } from './upload.routes'
import { orderRoutes } from './order.routes'
import { webhookRoutes } from './webhook.routes'
import { conversationRoutes } from './conversation.routes'
import { notificationRoutes } from './notification.routes'
import { subscriptionRoutes } from './subscription.routes'
import { adminRoutes } from './admin.routes'
import { paymentRoutes } from './payment.routes'

export const routes: Router = Router()

routes.get('/health', (_req, res) => res.json({ status: 'ok' }))
routes.use('/auth', authRoutes)
routes.use('/editors', editorRoutes)
routes.use('/categories', categoryRoutes)
routes.use('/portfolio', portfolioRoutes)
routes.use('/uploads', uploadRoutes)
routes.use('/orders', orderRoutes)
routes.use('/webhooks', webhookRoutes)
routes.use('/conversations', conversationRoutes)
routes.use('/notifications', notificationRoutes)
routes.use('/subscriptions', subscriptionRoutes)
routes.use('/admin', adminRoutes)
routes.use('/payments', paymentRoutes)
