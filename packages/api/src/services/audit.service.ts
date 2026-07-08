import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

// ─── Trilha de auditoria ───────────────────────────────────────────────────────
// Registra eventos relevantes (pagamentos, disputas, status, ações de admin).
// Chamado pelos outros services — não há endpoint público de escrita.

export type AuditAction =
  | 'ORDER_CREATED'
  | 'ORDER_CANCELLED'
  | 'PROPOSAL_ACCEPTED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_RELEASED'
  | 'PAYMENT_REFUNDED'
  | 'REVISION_REQUESTED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'USER_BANNED'
  | 'USER_UNBANNED'

export type AuditEntityType = 'Order' | 'Transaction' | 'Dispute' | 'Subscription' | 'User'

export interface LogEventParams {
  /** Usuário que disparou a ação; null para eventos de sistema (webhook, auto-aprovação) */
  actorId: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  metadata?: Prisma.InputJsonValue
}

/**
 * Grava um evento na trilha de auditoria. Fire-safe: falha de log nunca
 * derruba o fluxo principal (erro vai só para o console do servidor).
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata,
      },
    })
  } catch (err) {
    console.error('[audit] falha ao registrar evento', params.action, err)
  }
}
