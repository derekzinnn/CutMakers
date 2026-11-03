import { Router } from 'express'
import { UploadController } from '../controllers/upload.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { rateLimit } from '../middlewares/rate-limit.middleware'

export const uploadRoutes: Router = Router()
const ctrl = new UploadController()

// Pedir assinatura é grátis pra nós, mas cada uma vira um upload de verdade no
// Cloudinary (espaço, banda). Sem limite, uma conta comum vira um jeito de encher
// a conta Cloudinary da CutMakers. Por usuário, não por IP — o limite tem que
// valer mesmo atrás de NAT ou com o IP trocando.
const signatureLimit = rateLimit({
  name: 'upload-signature',
  windowMs: 10 * 60_000,
  max: 40,
  key: (req) => req.user?.sub ?? null,
  message: 'Muitos pedidos de upload. Aguarde um instante e tente novamente.',
})

/**
 * Qualquer usuário autenticado pode pedir uma assinatura (avatar, portfólio, ordem...).
 * Não restringimos por role aqui — a folder permitida cuida disso.
 */
uploadRoutes.post('/signature', authMiddleware, signatureLimit, ctrl.signature)
