import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

export const authRoutes: Router = Router()
const ctrl = new AuthController()

authRoutes.post('/register', ctrl.register)
authRoutes.post('/login', ctrl.login)
authRoutes.post('/google', ctrl.googleLogin)
authRoutes.post('/refresh', ctrl.refresh)
authRoutes.get('/me', authMiddleware, ctrl.me)
authRoutes.patch('/me', authMiddleware, ctrl.updateMe)
authRoutes.patch('/password', authMiddleware, ctrl.changePassword)
