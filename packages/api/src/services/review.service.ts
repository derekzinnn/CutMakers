import { prisma } from '../lib/prisma'
import { BadRequest, Forbidden, NotFound } from '../lib/errors'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CreateReviewData {
  rating: number
  comment?: string
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class ReviewService {
  async createReview(orderId: string, reviewerId: string, data: CreateReviewData) {
    if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
      throw BadRequest('Rating deve ser um inteiro entre 1 e 5')
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        review: true,
        editor: { include: { editorProfile: true } },
      },
    })
    if (!order) throw NotFound('Pedido não encontrado')
    if (order.creatorId !== reviewerId) throw Forbidden('Apenas o criador pode avaliar este pedido')
    if (order.status !== 'COMPLETED') throw BadRequest('Só é possível avaliar pedidos concluídos')
    if (order.review) throw BadRequest('Este pedido já foi avaliado')

    const editorProfile = order.editor.editorProfile
    if (!editorProfile) throw NotFound('Editor sem perfil')

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          orderId,
          reviewerId,
          revieweeId: order.editorId,
          rating: data.rating,
          comment: data.comment?.trim() || null,
        },
        include: {
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
        },
      })

      // Recalcula avgRating a partir de todas as avaliações do editor
      const agg = await tx.review.aggregate({
        where: { revieweeId: order.editorId },
        _avg: { rating: true },
      })

      await tx.editorProfile.update({
        where: { id: editorProfile.id },
        data: { avgRating: agg._avg.rating ?? 0 },
      })

      return created
    })

    return this.toDTO(review)
  }

  async getEditorReviews(editorUserId: string, params: { page?: number; limit?: number }) {
    const page = Math.max(params.page ?? 1, 1)
    const limit = Math.min(params.limit ?? 10, 20)
    const skip = (page - 1) * limit

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { revieweeId: editorUserId },
        include: {
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
          order: { select: { title: true, category: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { revieweeId: editorUserId } }),
    ])

    return {
      reviews: reviews.map(r => this.toDTO(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDTO = (review: any) => ({
    id: review.id,
    orderId: review.orderId,
    rating: review.rating,
    comment: review.comment as string | null,
    createdAt: review.createdAt,
    reviewer: {
      id: review.reviewer.id,
      name: review.reviewer.name,
      avatarUrl: review.reviewer.avatarUrl as string | null,
    },
    orderTitle: review.order?.title ?? null,
    orderCategory: review.order?.category?.name ?? null,
  })
}

export const reviewService = new ReviewService()
