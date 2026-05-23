import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { OrderService } from '../services/order.service'
import { PaymentService } from '../services/payment.service'
import { BadRequest } from '../lib/errors'

const orderService = new OrderService()
const paymentService = new PaymentService()

// ─── Schemas de validação ────────────────────────────────────────────────────

const fileSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(50),
})

const createSchema = z.object({
  editorId: z.string().uuid('editorId inválido'),
  categoryId: z.string().uuid('categoryId inválido'),
  portfolioItemId: z.string().uuid().optional(),
  title: z.string().min(3, 'Título muito curto').max(100),
  description: z.string().min(10, 'Descrição muito curta').max(5000),
  budget: z.number().positive('Orçamento deve ser positivo'),
  deadline: z.string().datetime().optional(),
  files: z.array(fileSchema).max(10).default([]),
})

const orderStatusEnum = z.enum([
  'PENDING',
  'ACCEPTED',
  'NEGOTIATING',
  'AWAITING_PAYMENT',
  'IN_PROGRESS',
  'DELIVERED',
  'REVISION_REQUESTED',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
])

const listSchema = z.object({
  role: z.enum(['creator', 'editor']).optional(),
  status: orderStatusEnum.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

const updateStatusSchema = z.object({
  status: orderStatusEnum,
})

const createDeliverySchema = z.object({
  videoUrl: z.string().url('URL do vídeo inválida'),
  message: z.string().max(2000).optional(),
})

// ─── Controller ──────────────────────────────────────────────────────────────

export class OrderController {
  // POST /api/orders
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Dados inválidos',
          errors: parsed.error.flatten().fieldErrors,
        })
      }

      const order = await orderService.create(req.user!.sub, {
        ...parsed.data,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : undefined,
      })
      return res.status(201).json({ order })
    } catch (err) {
      next(err)
    }
  }

  // GET /api/orders?role=creator|editor&status=...
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = listSchema.safeParse(req.query)
      if (!parsed.success) throw BadRequest('Filtros inválidos')

      const result = await orderService.list({
        userId: req.user!.sub,
        isAdmin: req.user!.role === 'ADMIN',
        role: parsed.data.role,
        status: parsed.data.status,
        page: parsed.data.page,
        limit: parsed.data.limit,
      })
      return res.json(result)
    } catch (err) {
      next(err)
    }
  }

  // GET /api/orders/:id
  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isAdmin = req.user!.role === 'ADMIN'
      const order = await orderService.getById(req.params.id, req.user!.sub, isAdmin)
      return res.json({ order })
    } catch (err) {
      next(err)
    }
  }

  // PATCH /api/orders/:id/status
  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateStatusSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Status inválido',
          errors: parsed.error.flatten().fieldErrors,
        })
      }

      const isAdmin = req.user!.role === 'ADMIN'
      const order = await orderService.updateStatus(
        req.params.id,
        req.user!.sub,
        isAdmin,
        parsed.data.status,
      )
      return res.json({ order })
    } catch (err) {
      next(err)
    }
  }

  // POST /api/orders/:id/deliveries
  createDelivery = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createDeliverySchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Dados inválidos',
          errors: parsed.error.flatten().fieldErrors,
        })
      }

      const delivery = await orderService.createDelivery(
        req.params.id,
        req.user!.sub,
        parsed.data,
      )
      return res.status(201).json({ delivery })
    } catch (err) {
      next(err)
    }
  }

  // POST /api/orders/:id/payment
  initiatePayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.initiatePayment(req.params.id, req.user!.sub)
      return res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  }
}
