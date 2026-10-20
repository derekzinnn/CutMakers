import { Router } from 'express'
import { projectRequestController as ctrl } from '../controllers/project-request.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole, EDITOR_ROLES, CREATOR_ROLES } from '../middlewares/role.middleware'

export const projectRequestRoutes: Router = Router()

projectRequestRoutes.use(authMiddleware)

const creator = requireRole(...CREATOR_ROLES)
const editor = requireRole('EDITOR', 'BOTH', 'ADMIN')

// ─── Rotas estáticas ANTES de /:id (senão o Express casa "mine" como id) ──────
projectRequestRoutes.get('/mine', creator, ctrl.listMine)
projectRequestRoutes.get('/proposals/mine', editor, ctrl.listMyProposals)

// ─── Coleção ──────────────────────────────────────────────────────────────────
projectRequestRoutes.get('/', editor, ctrl.listBoard) // quadro de oportunidades (só OPEN)
projectRequestRoutes.post('/', creator, ctrl.create)

// ─── Item ─────────────────────────────────────────────────────────────────────
// Detalhe: o service decide a perspectiva (criador vê propostas; editor vê só a sua)
projectRequestRoutes.get('/:id', ctrl.getById)
projectRequestRoutes.patch('/:id', creator, ctrl.update)
projectRequestRoutes.post('/:id/cancel', creator, ctrl.cancel)

// Propostas — editor
projectRequestRoutes.post('/:id/proposals', requireRole(...EDITOR_ROLES), ctrl.sendProposal)
projectRequestRoutes.patch('/:id/proposals/mine', requireRole(...EDITOR_ROLES), ctrl.updateMyProposal)
projectRequestRoutes.delete('/:id/proposals/mine', requireRole(...EDITOR_ROLES), ctrl.withdrawMyProposal)

// Propostas — creator decide
projectRequestRoutes.post('/:id/proposals/:proposalId/accept', creator, ctrl.acceptProposal)
projectRequestRoutes.post('/:id/proposals/:proposalId/reject', creator, ctrl.rejectProposal)
