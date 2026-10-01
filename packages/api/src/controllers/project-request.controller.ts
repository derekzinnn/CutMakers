import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { projectRequestService } from '../services/project-request.service'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const money = z.number().positive('Valor deve ser positivo').max(1_000_000)
const links = z.array(z.string().trim().url('Link de referência inválido')).max(10, 'Máximo de 10 links')

const createSchema = z
  .object({
    categoryId: z.string().uuid('categoryId inválido'),
    title: z.string().trim().min(3, 'Título muito curto').max(120),
    description: z.string().trim().min(10, 'Descreva melhor o projeto').max(5000),
    budgetMin: money.optional(),
    budgetMax: money.optional(),
    deadline: z.string().datetime('Prazo inválido').optional(),
    revisionsIncluded: z.number().int().min(0).max(10).optional(),
    referenceLinks: links.optional(),
  })
  .refine((d) => d.budgetMin === undefined || d.budgetMax === undefined || d.budgetMin <= d.budgetMax, {
    message: 'O orçamento mínimo não pode ser maior que o máximo',
    path: ['budgetMin'],
  })

const updateSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  budgetMin: money.nullable().optional(),
  budgetMax: money.nullable().optional(),
  deadline: z.string().datetime('Prazo inválido').nullable().optional(),
  referenceLinks: links.optional(),
})

const proposalSchema = z.object({
  amount: money,
  deliveryDays: z.number().int().min(1, 'Mínimo de 1 dia').max(365),
  message: z.string().trim().min(10, 'Explique sua proposta (mín. 10 caracteres)').max(2000),
})

const pageQuery = z.object({ page: z.coerce.number().int().min(1).optional() })

const boardQuery = z.object({
  category: z.string().uuid().optional(),
  budgetMin: z.coerce.number().min(0).optional(),
  budgetMax: z.coerce.number().min(0).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(['recent', 'budget_desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
})

const detailQuery = z.object({ sort: z.enum(['amount', 'rating']).optional() })

const toDate = (iso: string | null | undefined) => (iso == null ? iso : new Date(iso))

function invalid(res: Response, error: z.ZodError) {
  return res.status(400).json({ message: 'Dados inválidos', errors: error.flatten().fieldErrors })
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const projectRequestController = {
  // ── Creator ──
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = createSchema.safeParse(req.body)
      if (!parsed.success) return invalid(res, parsed.error)
      const { deadline, ...rest } = parsed.data
      const request = await projectRequestService.createRequest(req.user!.sub, {
        ...rest,
        deadline: deadline ? new Date(deadline) : undefined,
      })
      return res.status(201).json({ request })
    } catch (err) {
      next(err)
    }
  },

  async listMine(req: Request, res: Response, next: NextFunction) {
    try {
      const { page } = pageQuery.parse(req.query)
      return res.json(await projectRequestService.listMine(req.user!.sub, page))
    } catch (err) {
      next(err)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = updateSchema.safeParse(req.body)
      if (!parsed.success) return invalid(res, parsed.error)
      const { deadline, ...rest } = parsed.data
      const request = await projectRequestService.updateRequest(req.params.id as string, req.user!.sub, {
        ...rest,
        deadline: toDate(deadline),
      })
      return res.json({ request })
    } catch (err) {
      next(err)
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      return res.json(await projectRequestService.cancelRequest(req.params.id as string, req.user!.sub))
    } catch (err) {
      next(err)
    }
  },

  async acceptProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await projectRequestService.acceptProposal(
        req.params.id as string,
        req.params.proposalId as string,
        req.user!.sub,
      )
      return res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  },

  async rejectProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const proposal = await projectRequestService.rejectProposal(
        req.params.id as string,
        req.params.proposalId as string,
        req.user!.sub,
      )
      return res.json({ proposal })
    } catch (err) {
      next(err)
    }
  },

  // ── Compartilhado ──
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { sort } = detailQuery.parse(req.query)
      return res.json(await projectRequestService.getRequest(req.params.id as string, req.user!, sort))
    } catch (err) {
      next(err)
    }
  },

  // ── Editor ──
  async listBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = boardQuery.safeParse(req.query)
      if (!parsed.success) return invalid(res, parsed.error)
      return res.json(await projectRequestService.listOpen(req.user!.sub, parsed.data))
    } catch (err) {
      next(err)
    }
  },

  async sendProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = proposalSchema.safeParse(req.body)
      if (!parsed.success) return invalid(res, parsed.error)
      const proposal = await projectRequestService.sendProposal(req.params.id as string, req.user!.sub, parsed.data)
      return res.status(201).json({ proposal })
    } catch (err) {
      next(err)
    }
  },

  async updateMyProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = proposalSchema.partial().safeParse(req.body)
      if (!parsed.success) return invalid(res, parsed.error)
      const proposal = await projectRequestService.updateMyProposal(
        req.params.id as string,
        req.user!.sub,
        parsed.data,
      )
      return res.json({ proposal })
    } catch (err) {
      next(err)
    }
  },

  async withdrawMyProposal(req: Request, res: Response, next: NextFunction) {
    try {
      const proposal = await projectRequestService.withdrawMyProposal(req.params.id as string, req.user!.sub)
      return res.json({ proposal })
    } catch (err) {
      next(err)
    }
  },

  async listMyProposals(req: Request, res: Response, next: NextFunction) {
    try {
      const { page } = pageQuery.parse(req.query)
      return res.json(await projectRequestService.listMyProposals(req.user!.sub, page))
    } catch (err) {
      next(err)
    }
  },
}
