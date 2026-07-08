import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { adminService } from '../services/admin.service'

const roleEnum = z.enum(['CREATOR', 'EDITOR', 'BOTH', 'ADMIN'])
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

const listUsersQuery = z.object({
  search: z.string().trim().min(1).optional(),
  role: roleEnum.optional(),
  page: z.coerce.number().int().min(1).optional(),
})

const listOrdersQuery = z.object({
  status: orderStatusEnum.optional(),
  page: z.coerce.number().int().min(1).optional(),
})

const listTransactionsQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
})

const listAuditLogQuery = z.object({
  entityType: z.enum(['Order', 'Transaction', 'Dispute', 'Subscription', 'User']).optional(),
  action: z.string().trim().min(1).max(50).optional(),
  actorId: z.string().uuid().optional(),
  actorSearch: z.string().trim().min(1).max(120).optional(),
  orderId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
})

export const adminController = {
  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listUsersQuery.parse(req.query)
      res.json(await adminService.listUsers(query))
    } catch (err) {
      next(err)
    }
  },

  async banUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await adminService.setBanned(req.params.id as string, true, req.user!.sub)
      res.json({ user })
    } catch (err) {
      next(err)
    }
  },

  async unbanUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await adminService.setBanned(req.params.id as string, false, req.user!.sub)
      res.json({ user })
    } catch (err) {
      next(err)
    }
  },

  async listOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listOrdersQuery.parse(req.query)
      res.json(await adminService.listOrders(query))
    } catch (err) {
      next(err)
    }
  },

  async listDisputes(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ disputes: await adminService.listOpenDisputes() })
    } catch (err) {
      next(err)
    }
  },

  async financialSummary(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await adminService.financialSummary())
    } catch (err) {
      next(err)
    }
  },

  async listTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listTransactionsQuery.parse(req.query)
      res.json(await adminService.listTransactions(query))
    } catch (err) {
      next(err)
    }
  },

  async listAuditLog(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listAuditLogQuery.parse(req.query)
      res.json(await adminService.listAuditLog(query))
    } catch (err) {
      next(err)
    }
  },
}
