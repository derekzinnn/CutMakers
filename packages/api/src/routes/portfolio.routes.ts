import { Router } from 'express'
import { PortfolioController } from '../controllers/portfolio.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole, EDITOR_ROLES } from '../middlewares/role.middleware'

export const portfolioRoutes: Router = Router()
const ctrl = new PortfolioController()

// ─── Públicas ───────────────────────────────────────────────────────────────
portfolioRoutes.get('/', ctrl.list)
portfolioRoutes.get('/:id', ctrl.getById)

// ─── Autenticadas (apenas EDITOR ou BOTH criam itens) ──────────────────────
portfolioRoutes.post(
  '/',
  authMiddleware,
  requireRole(...EDITOR_ROLES),
  ctrl.create,
)

// ─── Update/Delete (ownership check feito no service; ADMIN passa) ─────────
portfolioRoutes.patch(
  '/:id',
  authMiddleware,
  requireRole('EDITOR', 'BOTH', 'ADMIN'),
  ctrl.update,
)
portfolioRoutes.delete(
  '/:id',
  authMiddleware,
  requireRole('EDITOR', 'BOTH', 'ADMIN'),
  ctrl.delete,
)
