import { Router } from 'express'
import { gatewayEnabled } from '../lib/abacatepay'
import { userDeletionEnabled } from '../services/user-delete.service'

export const configRoutes: Router = Router()

// Configuração pública, sem dado sensível: o front só precisa saber se os pagamentos são reais.
// Sem chave do gateway o sistema roda em modo demonstração (cobrança simulada que confirma na hora).
configRoutes.get('/', (_req, res) => {
  res.json({ paymentsSimulated: !gatewayEnabled(), userDeletionEnabled: userDeletionEnabled() })
})
