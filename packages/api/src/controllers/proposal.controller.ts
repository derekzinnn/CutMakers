import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { proposalService } from '../services/proposal.service'

const createProposalSchema = z.object({
  amount: z.number().positive('Valor deve ser positivo'),
  message: z.string().max(2000).optional(),
})

export class ProposalController {
  // GET /api/orders/:id/proposals
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const proposals = await proposalService.list(
        req.params.id as string,
        req.user!.sub,
        req.user!.role === 'ADMIN',
      )
      return res.json({ proposals })
    } catch (err) {
      next(err)
    }
  }

  // POST /api/orders/:id/proposals
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createProposalSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors })
      }
      const proposal = await proposalService.create(
        req.params.id as string,
        req.user!.sub,
        parsed.data.amount,
        parsed.data.message,
      )
      return res.status(201).json({ proposal })
    } catch (err) {
      next(err)
    }
  }

  // POST /api/orders/:id/proposals/:proposalId/accept
  accept = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const proposal = await proposalService.accept(
        req.params.id as string,
        req.params.proposalId as string,
        req.user!.sub,
        req.user!.role === 'ADMIN',
      )
      return res.json({ proposal })
    } catch (err) {
      next(err)
    }
  }

  // POST /api/orders/:id/proposals/:proposalId/reject
  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const proposal = await proposalService.reject(
        req.params.id as string,
        req.params.proposalId as string,
        req.user!.sub,
        req.user!.role === 'ADMIN',
      )
      return res.json({ proposal })
    } catch (err) {
      next(err)
    }
  }
}

export const proposalController = new ProposalController()
