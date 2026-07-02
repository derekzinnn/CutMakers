import { Router } from 'express'
import { UploadController } from '../controllers/upload.controller'
import { authMiddleware } from '../middlewares/auth.middleware'

export const uploadRoutes: Router = Router()
const ctrl = new UploadController()

/**
 * Qualquer usuário autenticado pode pedir uma assinatura (avatar, portfólio, ordem...).
 * Não restringimos por role aqui — a folder permitida cuida disso.
 */
uploadRoutes.post('/signature', authMiddleware, ctrl.signature)
