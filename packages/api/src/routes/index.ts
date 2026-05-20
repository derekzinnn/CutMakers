import { Router } from 'express'
import { authRoutes } from './auth.routes'
import { editorRoutes } from './editor.routes'
import { categoryRoutes } from './category.routes'
import { portfolioRoutes } from './portfolio.routes'
import { uploadRoutes } from './upload.routes'
import { orderRoutes } from './order.routes'

export const routes = Router()

routes.get('/health', (_req, res) => res.json({ status: 'ok' }))
routes.use('/auth', authRoutes)
routes.use('/editors', editorRoutes)
routes.use('/categories', categoryRoutes)
routes.use('/portfolio', portfolioRoutes)
routes.use('/uploads', uploadRoutes)
routes.use('/orders', orderRoutes)
