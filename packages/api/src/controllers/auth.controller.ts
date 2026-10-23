import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthService } from '../services/auth.service'
import { subscriptionService } from '../services/subscription.service'
import { orderService } from '../services/order.service'
import { logEvent } from '../services/audit.service'

const authService = new AuthService()

// O unique de User.email é case-sensitive no Postgres, então normalizamos aqui:
// sem isso "Derek@Gmail.com" criava uma segunda conta ao lado de "derek@gmail.com",
// e quem digitasse a caixa errada no login levava "Credenciais inválidas" com a
// senha certa. Normalizar no schema cobre registro e login pelo mesmo caminho.
export const emailField = z.string().trim().toLowerCase().email('Email inválido')

// bcrypt só considera os primeiros 72 bytes da senha: o resto seria ignorado em silêncio
// (a pessoa acharia que tem uma senha de 100 caracteres e na prática valem 72). Por isso o
// teto na CRIAÇÃO/TROCA é 72 — recusar é mais honesto que truncar. No LOGIN o teto é só
// uma guarda contra entrada gigante (CPU), alto o bastante para não trancar contas antigas.
export const PASSWORD_MAX = 72
const LOGIN_PASSWORD_MAX = 256
const newPassword = (label: string) =>
  z
    .string()
    .min(8, `${label} deve ter ao menos 8 caracteres`)
    .max(PASSWORD_MAX, `${label} deve ter no máximo ${PASSWORD_MAX} caracteres`)

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: emailField,
  password: newPassword('Senha'),
  role: z.enum(['CREATOR', 'EDITOR']),
  // Aceite obrigatório dos Termos de Uso da plataforma
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar os Termos de Uso para criar a conta' }),
  }),
})

export const updateMeSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter ao menos 2 caracteres').optional(),
  bio: z.string().trim().max(500, 'Bio muito longa').nullable().optional(),
  avatarUrl: z.string().url('URL inválida').nullable().optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual').max(LOGIN_PASSWORD_MAX),
  newPassword: newPassword('A nova senha'),
})

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(LOGIN_PASSWORD_MAX),
})

export class AuthController {
  register = async (req: Request, res: Response) => {
    const result = registerSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        message: 'Dados inválidos',
        errors: result.error.flatten().fieldErrors,
      })
    }

    const { name, email, password, role } = result.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ message: 'Email já cadastrado' })
    }

    const passwordHash = await authService.hashPassword(password)

    const user = await prisma.user.create({
      // termsAcceptedAt registra o aceite dos Termos de Uso (validado pelo schema)
      data: { name, email, passwordHash, role, termsAcceptedAt: new Date() },
      select: { id: true, name: true, email: true, role: true },
    })

    if (role === 'EDITOR') {
      await prisma.editorProfile.create({ data: { userId: user.id } })
    }

    const tokens = authService.generateTokens(user.id, user.role)

    return res.status(201).json({ ...tokens, user })
  }

  login = async (req: Request, res: Response) => {
    const result = loginSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: 'Dados inválidos' })
    }

    const { email, password } = result.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      // Mesmo custo de tempo de um login real — não revela se o e-mail existe
      await authService.dummyCompare(password)
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Esta conta usa login com Google. Entre com o Google.' })
    }
    const valid = await authService.comparePassword(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    if (user.banned) {
      return res.status(401).json({ message: 'Conta suspensa. Entre em contato com o suporte.' })
    }

    // Rotinas oportunistas no login (sem cron por enquanto).
    // A expiração de assinatura é aguardada: ela decide o `isPremium` que o
    // dashboard vai ler a seguir, e consulta só as vencidas.
    await subscriptionService.checkAndExpireSubscriptions()
    // A auto-aprovação vai para background com throttle: varre pedidos de todo
    // mundo, então o custo cresce com a tabela e não tem nada a ver com quem
    // está logando. Nenhum dado desta resposta depende dela.
    orderService.triggerAutoApproveInBackground()

    const tokens = authService.generateTokens(user.id, user.role)

    return res.json({
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  }

  // POST /api/auth/google — login/cadastro com ID token do Google.
  // So funciona com GOOGLE_CLIENT_ID configurado (senao a verificacao recusa).
  googleLogin = async (req: Request, res: Response) => {
    const idToken = (req.body?.idToken ?? '') as string
    if (!idToken) return res.status(400).json({ message: 'idToken obrigatório' })

    let info
    try {
      info = await authService.verifyGoogleToken(idToken)
    } catch (err) {
      return res.status(401).json({ message: err instanceof Error ? err.message : 'Token do Google inválido' })
    }

    // Procura por googleId, depois por email (vincula conta existente criada por senha)
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: info.sub }, { email: info.email }] },
    })

    if (user) {
      if (user.banned) {
        return res.status(401).json({ message: 'Conta suspensa. Entre em contato com o suporte.' })
      }
      // Primeira vez entrando por Google numa conta que existia por email: vincula
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: info.sub, avatarUrl: user.avatarUrl ?? info.picture },
        })
      }
    } else {
      // Conta nova: criador por padrao, sem senha, termos aceitos no ato
      user = await prisma.user.create({
        data: {
          name: info.name,
          email: info.email,
          googleId: info.sub,
          avatarUrl: info.picture,
          role: 'CREATOR',
          termsAcceptedAt: new Date(),
        },
      })
    }

    const tokens = authService.generateTokens(user.id, user.role)
    return res.json({
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
    })
  }

  refresh = async (req: Request, res: Response) => {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token não fornecido' })
    }

    try {
      const payload = authService.verifyRefreshToken(refreshToken)

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, name: true, email: true, role: true, banned: true },
      })
      if (!user) return res.status(401).json({ message: 'Usuário não encontrado' })

      // O refresh é o ponto de revalidação da sessão. Sem esta checagem, banir um
      // usuário não o expulsa: o front renova o par de tokens a cada 401 e a sessão
      // rola indefinidamente, já que o authMiddleware só verifica a assinatura do JWT.
      //
      // Optamos por checar aqui, e não no authMiddleware, de propósito: validar no
      // middleware custaria uma query ao banco em TODA request da API. Aqui o custo
      // é um lookup por chave primária a cada expiração de access token (~15min por
      // usuário ativo), e a janela máxima de acesso de um banido fica limitada à
      // validade do access token em vez de ser infinita.
      if (user.banned) {
        return res.status(401).json({ message: 'Conta suspensa. Entre em contato com o suporte.' })
      }

      // DTO explícito — `banned` é estado interno de moderacão, não vai para o cliente
      const tokens = authService.generateTokens(user.id, user.role)
      return res.json({
        ...tokens,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      })
    } catch {
      return res.status(401).json({ message: 'Refresh token inválido' })
    }
  }

  me = async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        bio: true,
        createdAt: true,
      },
    })
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' })

    return res.json({ user })
  }

  // PATCH /api/auth/me — edita nome, bio e avatar da conta
  updateMe = async (req: Request, res: Response) => {
    const parsed = updateMeSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors })
    }
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: parsed.data,
      select: { id: true, name: true, email: true, role: true, avatarUrl: true, bio: true, createdAt: true },
    })
    return res.json({ user })
  }

  // PATCH /api/auth/password — troca a senha (exige a atual)
  changePassword = async (req: Request, res: Response) => {
    const parsed = changePasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors })
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } })
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado' })

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Esta conta usa login com Google e não tem senha local.' })
    }
    const ok = await authService.comparePassword(parsed.data.currentPassword, user.passwordHash)
    if (!ok) return res.status(400).json({ message: 'Senha atual incorreta' })

    const passwordHash = await authService.hashPassword(parsed.data.newPassword)
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } })
    // Troca de credencial é evento de segurança: fica na trilha de auditoria (sem a senha)
    await logEvent({ actorId: user.id, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user.id })
    return res.json({ ok: true })
  }
}
