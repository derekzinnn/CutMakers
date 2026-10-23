import { Router } from 'express'
import { adminController } from '../controllers/admin.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

export const adminRoutes: Router = Router()

// Todas as rotas administrativas exigem autenticação + role ADMIN
adminRoutes.use(authMiddleware)
adminRoutes.use(requireRole('ADMIN'))

// Usuários
adminRoutes.get('/users', adminController.listUsers)
adminRoutes.patch('/users/:id/ban', adminController.banUser)
adminRoutes.patch('/users/:id/unban', adminController.unbanUser)
// Exclusão definitiva: só fora de produção (o service recusa em NODE_ENV=production)
adminRoutes.delete('/users/:id', adminController.deleteUser)

// Selo verificado (curado pelo admin)
adminRoutes.patch('/editors/:id/verify', adminController.verifyEditor)
adminRoutes.patch('/editors/:id/unverify', adminController.unverifyEditor)

// Pedidos
adminRoutes.get('/orders', adminController.listOrders)

// Disputas
adminRoutes.get('/disputes', adminController.listDisputes)

// Personas: criador/editor distintos da conta admin, para testar o produto com um login só
adminRoutes.post('/personas', adminController.startPersona)

// Dashboard (métricas por período)
adminRoutes.get('/dashboard', adminController.dashboard)

// Financeiro
adminRoutes.get('/financial-summary', adminController.financialSummary)
adminRoutes.get('/transactions', adminController.listTransactions)

// Auditoria
adminRoutes.get('/audit-log', adminController.listAuditLog)
