import { Router, Request, Response, NextFunction } from 'express'
import { PaymentService } from '../services/payment.service'

export const webhookRoutes = Router()
const paymentService = new PaymentService()

// POST /api/webhooks/abacatepay
// Recebe notificações de pagamento do Abacatepay.
// O body chega como Buffer graças ao express.raw() configurado no app.ts.
webhookRoutes.post('/abacatepay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body)
    const signature = req.headers['x-abacatepay-signature'] as string | undefined
    const result = await paymentService.handleWebhook(rawBody, signature)
    return res.json(result)
  } catch (err) {
    next(err)
  }
})
