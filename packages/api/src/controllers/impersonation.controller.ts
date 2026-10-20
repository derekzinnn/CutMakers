import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { impersonationService } from '../services/impersonation.service'

const startSchema = z.object({ userId: z.string().uuid('userId inválido') })

export class ImpersonationController {
  start = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = startSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ message: 'Dados inválidos', errors: parsed.error.flatten().fieldErrors })
      }
      const result = await impersonationService.start(req.user!.sub, parsed.data.userId)
      return res.json(result)
    } catch (err) {
      next(err)
    }
  }

  end = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = startSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ message: 'Dados inválidos' })
      }
      const result = await impersonationService.end(req.user!.sub, parsed.data.userId)
      return res.json(result)
    } catch (err) {
      next(err)
    }
  }
}
