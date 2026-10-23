import 'dotenv/config'
import { app } from './app'
import { assertAuthSecrets } from './lib/env-check'

// Em produção, segredo ausente/placeholder/duplicado aborta o boot (fail-closed)
assertAuthSecrets()

const PORT = process.env.PORT ?? 3333

app.listen(PORT, () => {
  console.log(`CutMakers API rodando em http://localhost:${PORT}`)
})
