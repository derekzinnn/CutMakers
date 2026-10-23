import { prisma } from '../lib/prisma'
import { Forbidden, NotFound } from '../lib/errors'
import { AuthService } from './auth.service'
import { logEvent } from './audit.service'

const authService = new AuthService()

/**
 * Personas do admin.
 *
 * O admin precisa testar/demonstrar o produto inteiro com um login só, mas criador e editor
 * têm que ser PESSOAS DIFERENTES: um pedido com o mesmo usuário nos dois lados quebraria o
 * contrato (aceite eletrônico das duas partes), o escrow (pagar a si mesmo) e a avaliação.
 *
 * Cada conta ADMIN ganha, sob demanda, dois usuários reais: uma persona CRIADOR e uma persona
 * EDITOR. São contas comuns (role CREATOR/EDITOR, passam por todas as regras de negócio),
 * sem senha — só o endpoint abaixo, que exige ADMIN, emite token para elas.
 */

export type PersonaKind = 'CREATOR' | 'EDITOR'

const LABELS: Record<PersonaKind, string> = { CREATOR: 'Criador', EDITOR: 'Editor' }

export async function startPersona(adminId: string, kind: PersonaKind) {
  const admin = await prisma.user.findUnique({ where: { id: adminId } })
  if (!admin) throw NotFound('Usuário não encontrado')
  if (admin.role !== 'ADMIN') throw Forbidden('Apenas administradores podem usar personas')
  if (admin.personaOfId) throw Forbidden('Uma persona não pode criar outras personas')

  let persona = await prisma.user.findUnique({
    where: { personaOfId_role: { personaOfId: adminId, role: kind } },
  })

  if (!persona) {
    persona = await prisma.user.create({
      data: {
        name: `${admin.name} (${LABELS[kind]})`,
        // .invalid é TLD reservado (RFC 2606): nunca resolve, nunca recebe e-mail de verdade
        email: `persona-${kind.toLowerCase()}-${adminId}@cutmakers.invalid`,
        role: kind,
        personaOfId: adminId,
        termsAcceptedAt: new Date(),
      },
    })
  }

  await logEvent({
    actorId: adminId,
    action: 'PERSONA_STARTED',
    entityType: 'User',
    entityId: persona.id,
    metadata: { persona: kind },
  })

  const { token, refreshToken } = authService.generateTokens(persona.id, persona.role)
  return {
    token,
    refreshToken,
    user: {
      id: persona.id,
      name: persona.name,
      email: persona.email,
      role: persona.role,
      avatarUrl: persona.avatarUrl,
      bio: persona.bio,
    },
  }
}
