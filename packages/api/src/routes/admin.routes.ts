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

// Pedidos
adminRoutes.get('/orders', adminController.listOrders)

// Disputas
adminRoutes.get('/disputes', adminController.listDisputes)

// Financeiro
adminRoutes.get('/financial-summary', adminController.financialSummary)
adminRoutes.get('/transactions', adminController.listTransactions)
