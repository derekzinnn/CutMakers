import { Router, Request, Response, NextFunction } from 'express'
import { PaymentService } from '../services/payment.service'

export const webhookRoutes: Router = Router()
const paymentService = new PaymentService()

// POST /api/webhooks/abacatepay?webhookSecret=...
// Recebe os eventos do AbacatePay v2. O corpo bruto (rawBody, capturado antes do parser
// JSON no app.ts) é o que a assinatura HMAC cobre — reserializar o JSON mudaria os bytes.
webhookRoutes.post('/abacatepay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body)
    const querySecret = typeof req.query.webhookSecret === 'string' ? req.query.webhookSecret : undefined
    const signature = req.headers['x-webhook-signature'] as string | undefined
    const result = await paymentService.handleWebhook(rawBody, { querySecret, signature })
    return res.json(result)
  } catch (err) {
    next(err)
  }
})
