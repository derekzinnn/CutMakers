import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { UploadService } from '../services/upload.service'
import { BadRequest } from '../lib/errors'

const uploadService = new UploadService()

const signatureSchema = z.object({
  folder: z.enum(['portfolio', 'avatars', 'orders', 'deliveries']),
  resourceType: z.enum(['image', 'video', 'auto']).optional(),
})

export class UploadController {
  // POST /api/uploads/signature
  signature = (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = signatureSchema.safeParse(req.body)
      if (!parsed.success) {
        throw BadRequest('Parâmetros inválidos para gerar assinatura')
      }

      const result = uploadService.generateSignature(parsed.data)
      return res.json(result)
    } catch (err) {
      next(err)
    }
  }
}
