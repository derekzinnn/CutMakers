import { Router } from 'express'
import { EditorController } from '../controllers/editor.controller'
import { reviewController } from '../controllers/review.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole, EDITOR_ROLES } from '../middlewares/role.middleware'

export const editorRoutes: Router = Router()
const ctrl = new EditorController()

/**
 * Rotas PÚBLICAS — qualquer um (autenticado ou não) pode listar e ver perfis.
 * Útil pro feed do creator e pro perfil público do editor.
 */
editorRoutes.get('/', ctrl.listEditors)

/**
 * Rotas DO PRÓPRIO PERFIL — precisam vir antes de /:id,
 * senão o Express casa "me" como id.
 */
editorRoutes.get('/me', authMiddleware, requireRole(...EDITOR_ROLES), ctrl.getMyProfile)
editorRoutes.patch('/me', authMiddleware, requireRole(...EDITOR_ROLES), ctrl.updateMyProfile)

/**
 * Perfil público — fica depois pra não conflitar com /me.
 */
editorRoutes.get('/:id', ctrl.getEditorById)

/**
 * Avaliações do editor — público, sem auth.
 */
editorRoutes.get('/:id/reviews', reviewController.listForEditor)
