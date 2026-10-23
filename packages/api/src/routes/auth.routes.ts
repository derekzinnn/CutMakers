import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { rateLimit } from '../middlewares/rate-limit.middleware'

export const authRoutes: Router = Router()
const ctrl = new AuthController()

const MINUTE = 60_000

// Limites por rota (contador separado por `name`). Chaves:
//  - login: por IP (teto geral) E por e-mail alvo (impede martelar UMA conta, mesmo
//    vindo de vários IPs, sem trancar quem divide o IP por NAT com outras contas)
//  - demais: por IP; troca de senha: por usuário autenticado
const loginByIp = rateLimit({ name: 'login-ip', windowMs: MINUTE, max: 30 })
const loginByEmail = rateLimit({
  name: 'login-email',
  windowMs: 15 * MINUTE,
  max: 10,
  message: 'Muitas tentativas de login para esta conta. Tente novamente em alguns minutos.',
  key: (req) => {
    const email = (req.body as { email?: unknown } | undefined)?.email
    return typeof email === 'string' && email.length > 0 ? email.trim().toLowerCase() : null
  },
})
const registerLimit = rateLimit({
  name: 'register',
  windowMs: 10 * MINUTE,
  max: 5,
  message: 'Muitos cadastros a partir desta rede. Tente novamente mais tarde.',
})
const googleLimit = rateLimit({ name: 'google', windowMs: MINUTE, max: 10 })
const refreshLimit = rateLimit({ name: 'refresh', windowMs: MINUTE, max: 30 })
const passwordLimit = rateLimit({
  name: 'password',
  windowMs: 15 * MINUTE,
  max: 5,
  key: (req) => req.user?.sub ?? null,
  message: 'Muitas tentativas de troca de senha. Tente novamente em alguns minutos.',
})

authRoutes.post('/register', registerLimit, ctrl.register)
authRoutes.post('/login', loginByIp, loginByEmail, ctrl.login)
authRoutes.post('/google', googleLimit, ctrl.googleLogin)
authRoutes.post('/refresh', refreshLimit, ctrl.refresh)
authRoutes.get('/me', authMiddleware, ctrl.me)
authRoutes.patch('/me', authMiddleware, ctrl.updateMe)
authRoutes.patch('/password', authMiddleware, passwordLimit, ctrl.changePassword)
