import { Router } from 'express'
import { OrderController } from '../controllers/order.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

export const orderRoutes = Router()
const ctrl = new OrderController()

// Todas as rotas exigem autenticação
orderRoutes.use(authMiddleware)

orderRoutes.get('/', ctrl.list)
orderRoutes.get('/:id', ctrl.getById)

// Apenas creators (ou BOTH/ADMIN) podem criar pedidos
orderRoutes.post('/', requireRole('CREATOR', 'BOTH', 'ADMIN'), ctrl.create)
