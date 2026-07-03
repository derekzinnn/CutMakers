import express, { Express, Request } from 'express'
import cors from 'cors'
import { routes } from './routes'
import { errorMiddleware } from './middlewares/error.middleware'

export const app: Express = express()

// CORS: em produção restringe às origens listadas em CORS_ORIGIN (separadas por vírgula,
// ex.: "https://cutmakers.derek.dev.br"). Sem CORS_ORIGIN definido (dev) libera todas as origens.
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean)
app.use(cors(corsOrigins && corsOrigins.length > 0 ? { origin: corsOrigins } : undefined))

// Healthcheck simples usado pelo Docker (não toca no banco) — responde 200
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

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
