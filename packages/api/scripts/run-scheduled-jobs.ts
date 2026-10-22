/**
 * Rotinas agendadas da plataforma — para rodar por um CRON de verdade.
 *
 * Hoje a auto-aprovacao de entregas paradas (clausula 4b) e a expiracao de
 * assinaturas vencidas rodam de forma OPORTUNISTA no login. Isso tem dois
 * problemas: depende de alguem logar, e um editor que nao loga nunca libera o
 * pagamento de quem o aprovou automaticamente.
 *
 * Este script faz as duas de forma deterministica. O login-trigger continua
 * como rede de seguranca (nao foi removido), mas o caminho correto e um cron.
 *
 * Como agendar no VPS: adicione ao crontab do usuario do app uma linha que rode
 * este script a cada 15 minutos (campo minuto = barra-15), por exemplo:
 *     cd /caminho/cutmakers/packages/api
 *     pnpm jobs
 * redirecionando a saida para um log. Idempotente: rodar varias vezes nao
 * duplica efeitos (os services usam claim otimista).
 */
import 'dotenv/config'
import { orderService } from '../src/services/order.service'
import { subscriptionService } from '../src/services/subscription.service'
import { prisma } from '../src/lib/prisma'

async function main() {
  const inicio = Date.now()
  console.log(`[jobs] inicio ${new Date().toISOString()}`)

  // 1) Assinaturas vencidas -> EXPIRED + isPremium false
  await subscriptionService.checkAndExpireSubscriptions()
  console.log('[jobs] assinaturas vencidas processadas')

  // 2) Entregas paradas ha 7+ dias em DELIVERED -> COMPLETED + pagamento liberado.
  //    Aqui e AWAITED (diferente do login, que dispara em background): o cron
  //    existe justamente para garantir que a varredura termine.
  const r = await orderService.autoApproveStaleDeliveries()
  console.log(`[jobs] auto-aprovacao: ${r.processed} pedido(s) na janela`)

  console.log(`[jobs] fim em ${Date.now() - inicio}ms`)
}

main()
  .catch((err) => {
    console.error('[jobs] falhou:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
