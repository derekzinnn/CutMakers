import { Router } from 'express'
import { OrderController } from '../controllers/order.controller'
import { reviewController } from '../controllers/review.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

export const orderRoutes = Router()
const ctrl = new OrderController()

orderRoutes.use(authMiddleware)

orderRoutes.get('/', ctrl.list)
orderRoutes.get('/:id', ctrl.getById)

// Apenas creators (ou BOTH/ADMIN) podem criar pedidos
orderRoutes.post('/', requireRole('CREATOR', 'BOTH', 'ADMIN'), ctrl.create)

// Qualquer parte do pedido pode atualizar o status (service valida a transição)
orderRoutes.patch('/:id/status', ctrl.updateStatus)

// Apenas editors (ou BOTH/ADMIN) enviam entregas
orderRoutes.post('/:id/deliveries', requireRole('EDITOR', 'BOTH', 'ADMIN'), ctrl.createDelivery)

// Apenas creators (ou BOTH/ADMIN) iniciam pagamento
orderRoutes.post('/:id/payment', requireRole('CREATOR', 'BOTH', 'ADMIN'), ctrl.initiatePayment)

// Apenas creators (ou BOTH) avaliam pedidos COMPLETED
orderRoutes.post('/:id/review', requireRole('CREATOR', 'BOTH'), reviewController.create)
