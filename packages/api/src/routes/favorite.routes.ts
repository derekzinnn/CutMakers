import { Router } from 'express'
import { favoriteController } from '../controllers/favorite.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { requireRole, CREATOR_ROLES } from '../middlewares/role.middleware'

export const favoriteRoutes: Router = Router()

// Favoritar editores é coisa de criador (ADMIN incluso via CREATOR_ROLES)
favoriteRoutes.use(authMiddleware)
favoriteRoutes.use(requireRole(...CREATOR_ROLES))

favoriteRoutes.get('/', favoriteController.list)
favoriteRoutes.get('/ids', favoriteController.listIds)
favoriteRoutes.post('/:editorUserId/toggle', favoriteController.toggle)
