import { OrderAgreement } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'

// ─── Regras do contrato (mantenha em sincronia com o template abaixo) ─────────

export const TERMS_VERSION = '1.0'
export const INCLUDED_REVISIONS = 2
export const AUTO_APPROVE_DAYS = 7
export const EDITOR_ABANDON_BUSINESS_DAYS = 5
export const LATE_DELIVERY_DAYS = 5

// ─── DTO ───────────────────────────────────────────────────────────────────────

export function agreementToDTO(a: OrderAgreement) {
  return {
    id: a.id,
    orderId: a.orderId,
    termsVersion: a.termsVersion,
    content: a.content,
    creatorAcceptedAt: a.creatorAcceptedAt,
    editorAcceptedAt: a.editorAcceptedAt,
    bothAccepted: a.creatorAcceptedAt !== null && a.editorAcceptedAt !== null,
    createdAt: a.createdAt,
  }
}

// ─── Template do termo ─────────────────────────────────────────────────────────

interface AgreementData {
  orderId: string
  orderTitle: string
  creatorName: string
  creatorEmail: string
  editorName: string
  editorEmail: string
  amount: number
  platformFee: number
  deadline: Date | null
}

const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function buildAgreementContent(d: AgreementData): string {
  const net = d.amount - d.platformFee
  const deadline = d.deadline ? d.deadline.toLocaleDateString('pt-BR') : 'a combinar entre as partes'
  const today = new Date().toLocaleDateString('pt-BR')

  return `TERMO DE PRESTAÇÃO DE SERVIÇO — CutMakers (v${TERMS_VERSION})

Pedido: ${d.orderTitle} · nº ${d.orderId}
Contratante (Criador): ${d.creatorName} · ${d.creatorEmail}
Contratado (Editor): ${d.editorName} · ${d.editorEmail}
Valor acordado: R$ ${brl(d.amount)} · Taxa da plataforma (10%): R$ ${brl(d.platformFee)} · Valor líquido ao Editor: R$ ${brl(net)}
Prazo de entrega: ${deadline} · Data do acordo: ${today}

1. OBJETO. O Editor produzirá a edição de vídeo descrita no briefing do pedido e na proposta aceita, que definem o ESCOPO deste contrato. O que não está no briefing/proposta não faz parte do escopo.

2. PAGAMENTO EM CUSTÓDIA (ESCROW). O Criador paga o valor integral antecipadamente à CutMakers, que o mantém retido em custódia. O Editor só recebe após a aprovação da entrega (ou nos casos das cláusulas 6 e 7). O Criador não paga o Editor diretamente em nenhuma hipótese.

3. ENTREGA E REVISÕES.
a) O Editor entregará dentro do prazo acordado, pela plataforma.
b) O Criador tem direito a até ${INCLUDED_REVISIONS} (duas) rodadas de revisão inclusas, desde que os ajustes estejam dentro do escopo original. Pedidos fora do escopo (novo material, mudança de conceito, duração maior) exigem nova negociação.
c) Cada solicitação de revisão deve descrever objetivamente o que deve ser alterado.

4. APROVAÇÃO.
a) Aprovada a entrega, o pagamento é liberado ao Editor (descontada a taxa) e os direitos da cláusula 8 se transferem.
b) APROVAÇÃO AUTOMÁTICA: se o Criador não aprovar, solicitar revisão ou abrir disputa em até ${AUTO_APPROVE_DAYS} (sete) dias corridos após uma entrega, ela é considerada aprovada e o pagamento é liberado ao Editor.

5. DISPUTA E FISCALIZAÇÃO.
a) Esgotadas as revisões (ou em impasse), o Criador pode abrir disputa. O pedido é congelado e o valor permanece em custódia.
b) A equipe CutMakers analisará se a entrega condiz objetivamente com o briefing e a proposta aceita. Critério: conformidade com o escopo — não gosto pessoal.
c) Entrega conforme o escopo → pagamento liberado ao Editor. Entrega em desacordo → reembolso integral ao Criador.
d) A decisão da equipe, baseada nos registros da plataforma, encerra a disputa.

6. CANCELAMENTO PELO EDITOR. Se o Editor cancelar, abandonar o projeto ou ficar sem responder por mais de ${EDITOR_ABANDON_BUSINESS_DAYS} dias úteis após o início, o Criador recebe reembolso integral.

7. CANCELAMENTO PELO CRIADOR / ATRASO.
a) Antes do início do trabalho (pagamento ainda não confirmado): cancelamento livre.
b) Após o início, o cancelamento pelo Criador sem descumprimento do Editor não gera reembolso automático — vai para análise da equipe (cláusula 5).
c) Se o Editor atrasar a entrega em mais de ${LATE_DELIVERY_DAYS} dias corridos sem acordo registrado na plataforma, o Criador pode cancelar com reembolso integral.

8. DIREITOS AUTORAIS.
a) Com o pagamento liberado, todos os direitos sobre o vídeo final transferem-se ao Criador.
b) O Editor pode exibir o trabalho em seu portfólio na CutMakers, salvo se o Criador marcar o pedido como confidencial antes do início.
c) O Criador declara possuir os direitos sobre os materiais brutos enviados, isentando o Editor e a CutMakers de violações de terceiros.

9. MATERIAIS E CONFIDENCIALIDADE. O Editor usará os materiais recebidos exclusivamente para este pedido e não os divulgará. Após a conclusão, deve excluí-los se solicitado.

10. COMUNICAÇÃO E REGISTRO. Toda comunicação relevante deve ocorrer pela plataforma. Acordos feitos fora dela não têm validade para fins de disputa.

11. NÃO CIRCUNVENÇÃO. É vedado negociar ou pagar este serviço fora da CutMakers. A violação pode resultar em suspensão de ambas as contas.

12. ACEITE ELETRÔNICO. Este termo é aceito eletronicamente por ambas as partes, com registro de data, hora e versão, o que equivale à assinatura para todos os fins.`
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class AgreementService {
  /**
   * Garante que o contrato do pedido existe (cria se necessário).
   * Chamado no aceite da proposta e, de forma self-healing, no gate de pagamento.
   */
  async ensureAgreement(orderId: string) {
    const existing = await prisma.orderAgreement.findUnique({ where: { orderId } })
    if (existing) return agreementToDTO(existing)

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        title: true,
        budget: true,
        platformFee: true,
        deadline: true,
        creator: { select: { name: true, email: true } },
        editor: { select: { name: true, email: true } },
      },
    })
    if (!order) throw NotFound('Pedido não encontrado')

    const content = buildAgreementContent({
      orderId: order.id,
      orderTitle: order.title,
      creatorName: order.creator.name,
      creatorEmail: order.creator.email,
      editorName: order.editor.name,
      editorEmail: order.editor.email,
      amount: Number(order.budget),
      platformFee: Number(order.platformFee),
      deadline: order.deadline,
    })

    const created = await prisma.orderAgreement.create({
      data: { orderId, termsVersion: TERMS_VERSION, content },
    })
    return agreementToDTO(created)
  }

  /**
   * Regenera o termo com os valores atuais do pedido (chamado no aceite de proposta).
   * Se havia um termo ainda não aceito por ambos, ele é substituído — os aceites
   * anteriores caem, pois o valor acordado mudou.
   */
  async regenerateAgreement(orderId: string) {
    const existing = await prisma.orderAgreement.findUnique({ where: { orderId } })
    if (existing) {
      if (existing.creatorAcceptedAt && existing.editorAcceptedAt) {
        // Contrato já fechado por ambos — não substitui
        return agreementToDTO(existing)
      }
      await prisma.orderAgreement.delete({ where: { orderId } })
    }
    return this.ensureAgreement(orderId)
  }

  /** Registra o aceite da parte logada (criador ou editor). */
  async acceptAgreement(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, title: true, creatorId: true, editorId: true },
    })
    if (!order) throw NotFound('Pedido não encontrado')

    const isCreator = order.creatorId === userId
    const isEditor = order.editorId === userId
    if (!isCreator && !isEditor) throw Forbidden('Você não faz parte deste pedido')

    // Garante que o termo existe antes de aceitar
    await this.ensureAgreement(orderId)
    const agreement = await prisma.orderAgreement.findUniqueOrThrow({ where: { orderId } })

    const alreadyAccepted = isCreator ? agreement.creatorAcceptedAt : agreement.editorAcceptedAt
    if (alreadyAccepted) throw BadRequest('Você já aceitou os termos deste contrato')

    const updated = await prisma.orderAgreement.update({
      where: { orderId },
      data: isCreator ? { creatorAcceptedAt: new Date() } : { editorAcceptedAt: new Date() },
    })

    // Ambos aceitaram → avisa o criador que o pagamento está liberado para ser feito
    if (updated.creatorAcceptedAt && updated.editorAcceptedAt) {
      await prisma.notification.create({
        data: {
          userId: order.creatorId,
          type: 'CONTRACT_ACCEPTED',
          title: 'Contrato aceito por ambas as partes',
          body: `O contrato de "${order.title}" foi aceito. Realize o pagamento para o projeto iniciar.`,
          relatedOrderId: orderId,
        },
      })
    } else {
      // Avisa a contraparte que falta o aceite dela
      const otherId = isCreator ? order.editorId : order.creatorId
      await prisma.notification.create({
        data: {
          userId: otherId,
          type: 'CONTRACT_ACCEPTED',
          title: 'Contrato aguardando seu aceite',
          body: `A contraparte aceitou os termos de "${order.title}". Falta apenas o seu aceite.`,
          relatedOrderId: orderId,
        },
      })
    }

    return agreementToDTO(updated)
  }
}

export const agreementService = new AgreementService()
