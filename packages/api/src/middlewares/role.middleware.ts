import { Request, Response, NextFunction } from 'express'
import { Role } from '@prisma/client'

/**
 * Middleware factory que restringe uma rota a roles específicas.
 * Deve ser usado APÓS o authMiddleware (depende de req.user).
 *
 * @example
 *   router.patch('/me', authMiddleware, requireRole('EDITOR', 'BOTH'), ctrl.updateMe)
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autenticado' })
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      return res.status(403).json({
        message: 'Acesso negado para esta role',
        required: allowedRoles,
        current: req.user.role,
      })
    }

    next()
  }
}

/**
 * Papeis que podem AGIR como editor / como criador.
 *
 * ADMIN entra nos dois de proposito: a conta administrativa tambem e uma conta
 * de editor e de criador, acessada pelo mesmo login. Isso existe para que o
 * dono consiga demonstrar o produto inteiro numa venda sem precisar de tres
 * contas, e para o admin conseguir ver o sistema como os usuarios veem.
 *
 * Nao e impersonacao: o admin age como ELE MESMO, com os proprios pedidos e o
 * proprio portfolio. As travas de dono continuam valendo (ele nao pode propor
 * na propria solicitacao, por exemplo).
 *
 * Constantes em vez de espalhar 'ADMIN' por doze rotas: assim nao da para
 * esquecer uma e criar um buraco de 403 so em um canto do sistema.
 */
export const EDITOR_ROLES = ['EDITOR', 'BOTH', 'ADMIN'] as const
export const CREATOR_ROLES = ['CREATOR', 'BOTH', 'ADMIN'] as const

/**
 * Este usuario pode ser CONTRATADO como editor? Mesma regra de EDITOR_ROLES, para as checagens de
 * servico (alvo de um pedido, aceite de proposta). Sem isto o admin aparecia na busca de editores
 * (tem perfil) mas o pedido para ele falhava com "nao e editor".
 */
export const canBeHiredAsEditor = (role: string): boolean =>
  (EDITOR_ROLES as readonly string[]).includes(role)
