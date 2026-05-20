import { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AuthService } from '../services/auth.service'

const authService = new AuthService()

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(['CREATOR', 'EDITOR']),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
      data: { name, email, passwordHash, role },
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
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    const valid = await authService.comparePassword(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }

    const tokens = authService.generateTokens(user.id, user.role)

    return res.json({
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
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
        select: { id: true, name: true, email: true, role: true },
      })
      if (!user) return res.status(401).json({ message: 'Usuário não encontrado' })

      const tokens = authService.generateTokens(user.id, user.role)
      return res.json({ ...tokens, user })
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
}
