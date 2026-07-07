import { Router } from 'express'
import { OrderController } from '../controllers/order.controller'
import { reviewController } from '../controllers/review.controller'
import { proposalController } from '../controllers/proposal.controller'
import { revisionController } from '../controllers/revision.controller'
import { disputeController } from '../controllers/dispute.controller'
import { agreementController } from '../controllers/agreement.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

export const orderRoutes: Router = Router()
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

// Creator adiciona arquivos a um pedido existente
orderRoutes.post('/:id/files', requireRole('CREATOR', 'BOTH', 'ADMIN'), ctrl.addFiles)

// Propostas de negociação (ambas as partes)
orderRoutes.get('/:id/proposals', proposalController.list)
orderRoutes.post('/:id/proposals', proposalController.create)
orderRoutes.post('/:id/proposals/:proposalId/accept', proposalController.accept)
orderRoutes.post('/:id/proposals/:proposalId/reject', proposalController.reject)

// Revisões formais (creator solicita, ambas as partes visualizam)
orderRoutes.get('/:id/revisions', revisionController.list)
orderRoutes.post('/:id/revisions', requireRole('CREATOR', 'BOTH'), revisionController.create)

// Disputas (creator abre, apenas ADMIN resolve)
orderRoutes.post('/:id/dispute', requireRole('CREATOR', 'BOTH'), disputeController.open)
orderRoutes.post('/:id/dispute/resolve', requireRole('ADMIN'), disputeController.resolve)

// Contrato do pedido — aceite de cada parte (o service valida quem é parte)
orderRoutes.post('/:id/agreement/accept', agreementController.accept)
