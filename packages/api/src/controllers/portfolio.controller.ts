import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { PortfolioService } from '../services/portfolio.service'
import { BadRequest } from '../lib/errors'

const portfolioService = new PortfolioService()

const listQuerySchema = z.object({
  editor: z.string().uuid().optional(),
  category: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

const createSchema = z.object({
  title: z.string().min(3, 'Título muito curto').max(100),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid('categoryId inválido'),
  videoUrl: z.string().url('videoUrl inválida'),
  thumbnailUrl: z.string().url().optional(),
  basePrice: z.number().positive('Preço deve ser positivo'),
})

const updateSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(1000).optional(),
  categoryId: z.string().uuid().optional(),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  basePrice: z.number().positive().optional(),
})

export class PortfolioController {
  // GET /api/portfolio?editor=...&category=...&page=...&limit=...
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        throw BadRequest('Filtros inválidos')
      }

      const data = await portfolioService.list({
        editorUserId: parsed.data.editor,
        categoryId: parsed.data.category,
        page: parsed.data.page,
        limit: parsed.data.limit,
      })
      return res.json(data)
    } catch (err) {
      next(err)
    }
  }

  // GET /api/portfolio/:id
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await portfolioService.getById(req.params.id as string)
      return res.json({ item })
    } catch (err) {
      next(err)
    }
  }

  // POST /api/portfolio
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Dados inválidos',
          errors: parsed.error.flatten().fieldErrors,
        })
      }

      const item = await portfolioService.create(req.user!.sub, parsed.data)
      return res.status(201).json({ item })
    } catch (err) {
      next(err)
    }
  }

  // PATCH /api/portfolio/:id
  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Dados inválidos',
          errors: parsed.error.flatten().fieldErrors,
        })
      }

      const isAdmin = req.user!.role === 'ADMIN'
      const item = await portfolioService.update(
        req.params.id as string,
        req.user!.sub,
        isAdmin,
        parsed.data,
      )
      return res.json({ item })
    } catch (err) {
      next(err)
    }
  }

  // DELETE /api/portfolio/:id
  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === 'ADMIN'
      await portfolioService.delete(req.params.id as string, req.user!.sub, isAdmin)
      return res.status(204).send()
    } catch (err) {
      next(err)
    }
  }
}
