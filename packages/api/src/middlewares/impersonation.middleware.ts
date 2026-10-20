import { Request, Response, NextFunction } from 'express'

/**
 * Sessão impersonada é SOMENTE LEITURA.
 *
 * Roda depois do authMiddleware, antes das rotas. Qualquer método que não seja
 * GET é recusado quando o token carrega `imp`.
 *
 * O motivo é jurídico antes de técnico: o produto tem contrato com aceite
 * eletrônico e escrow. Escrever como outra pessoa significaria poder aceitar um
 * termo em nome dela — forjar consentimento — ou mandar mensagem no chat que
 * depois vira prova na disputa que o próprio admin vai julgar.
 *
 * Para AGIR, o admin usa /api/admin, onde ele aparece como ator na auditoria.
 */
export function readOnlyWhenImpersonating(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.imp) return next()

  if (req.method !== 'GET') {
    return res.status(403).json({
      message:
        'Sessão de visualização é somente leitura. Saia dela para agir como administrador.',
      impersonating: true,
    })
  }

  return next()
}
