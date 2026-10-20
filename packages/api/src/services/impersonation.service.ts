import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'
import { AuthService } from './auth.service'
import { logEvent } from './audit.service'

const authService = new AuthService()

/**
 * Impersonação administrativa — "ver o sistema como o usuário vê".
 *
 * Existe para mediação de disputa: quando o admin decide se a entrega condiz
 * com o briefing (cláusula 5 do contrato), ele precisa ver o pedido do mesmo
 * jeito que as partes veem, não um resumo.
 *
 * ─── SOMENTE LEITURA, e isso não é preguiça ───────────────────────────────
 * A sessão impersonada recusa qualquer método que não seja GET.
 *
 * Este produto tem contrato com aceite eletrônico, escrow e disputa. Um admin
 * escrevendo como outra pessoa poderia aceitar um termo em nome dela — ou seja,
 * forjar consentimento num documento que as partes assinam. Também poderia
 * enviar mensagem no chat que depois vira prova na própria disputa que ele vai
 * julgar. Nenhum ganho operacional compensa isso: para AGIR, o admin tem as
 * rotas /api/admin, que registram ele como ator na auditoria.
 *
 * Travas:
 *  - só ADMIN inicia
 *  - não impersona outro ADMIN (mesma regra do ban)
 *  - token curto (15min) e SEM refresh token — a sessão morre sozinha
 *  - `/auth/refresh` recusa token impersonado (senão viraria escalação: trocar
 *    um token temporário de leitura por um normal de escrita)
 *  - toda sessão fica na auditoria, com quem impersonou quem
 */
const IMPERSONATION_TTL = '15m'

export class ImpersonationService {
  async start(adminId: string, targetUserId: string) {
    if (adminId === targetUserId) {
      throw BadRequest('Você já está nesta conta')
    }

    const alvo = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true, banned: true },
    })
    if (!alvo) throw NotFound('Usuário não encontrado')
    if (alvo.role === 'ADMIN') {
      throw Forbidden('Não é possível ver o sistema como outro administrador')
    }

    const token = authService.generateImpersonationToken(
      { sub: alvo.id, role: alvo.role },
      adminId,
      IMPERSONATION_TTL,
    )

    await logEvent({
      actorId: adminId,
      action: 'IMPERSONATION_STARTED',
      entityType: 'User',
      entityId: alvo.id,
      metadata: { targetName: alvo.name, targetEmail: alvo.email, targetRole: alvo.role },
    })

    return {
      token,
      expiresInMinutes: 15,
      readOnly: true as const,
      user: { id: alvo.id, name: alvo.name, email: alvo.email, role: alvo.role, banned: alvo.banned },
    }
  }

  /** Encerrar é só descartar o token no cliente; aqui fica o registro. */
  async end(adminId: string, targetUserId: string) {
    await logEvent({
      actorId: adminId,
      action: 'IMPERSONATION_ENDED',
      entityType: 'User',
      entityId: targetUserId,
    })
    return { ended: true }
  }
}

export const impersonationService = new ImpersonationService()
