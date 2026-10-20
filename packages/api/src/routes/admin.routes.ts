import { Router } from 'express'
import { adminController } from '../controllers/admin.controller'
import { ImpersonationController } from '../controllers/impersonation.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

export const adminRoutes: Router = Router()
const impersonation = new ImpersonationController()

// Todas as rotas administrativas exigem autenticação + role ADMIN
adminRoutes.use(authMiddleware)
adminRoutes.use(requireRole('ADMIN'))

// Usuários
adminRoutes.get('/users', adminController.listUsers)
adminRoutes.patch('/users/:id/ban', adminController.banUser)
adminRoutes.patch('/users/:id/unban', adminController.unbanUser)

// Pedidos
adminRoutes.get('/orders', adminController.listOrders)

// Disputas
adminRoutes.get('/disputes', adminController.listDisputes)

// Financeiro
adminRoutes.get('/financial-summary', adminController.financialSummary)
adminRoutes.get('/transactions', adminController.listTransactions)

// Auditoria
adminRoutes.get('/audit-log', adminController.listAuditLog)

// Impersonacao — "ver o sistema como o usuario ve" (mediacao de disputa).
// A sessao gerada e SOMENTE LEITURA: ver impersonation.middleware.
adminRoutes.post('/impersonate', impersonation.start)
adminRoutes.post('/impersonate/end', impersonation.end)
