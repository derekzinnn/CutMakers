import express, { Request } from 'express'
import cors from 'cors'
import { routes } from './routes'
import { errorMiddleware } from './middlewares/error.middleware'

export const app = express()

app.use(cors())

// Salva o rawBody antes do parser JSON — necessário para validar assinatura HMAC dos webhooks
app.use(
  express.json({
    verify: (req: Request & { rawBody?: string }, _res, buf) => {
      req.rawBody = buf.toString('utf8')
    },
  }),
)

app.use('/api', routes)

app.use(errorMiddleware)
