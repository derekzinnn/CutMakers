import { prisma } from '../lib/prisma'
import { NotFound } from '../lib/errors'

/**
 * Favoritos: um criador marca editores para achar depois.
 *
 * Toggle idempotente — favoritar o que já é favorito remove, e vice-versa.
 * O @@unique([userId, editorProfileId]) garante no banco que não há duplicata.
 */
export class FavoriteService {
  /** Alterna o favorito. Retorna o estado final. */
  async toggle(userId: string, editorUserId: string) {
    const profile = await prisma.editorProfile.findUnique({
      where: { userId: editorUserId },
      select: { id: true },
    })
    if (!profile) throw NotFound('Editor não encontrado')

    const existente = await prisma.favorite.findUnique({
      where: { userId_editorProfileId: { userId, editorProfileId: profile.id } },
      select: { id: true },
    })

    if (existente) {
      await prisma.favorite.delete({ where: { id: existente.id } })
      return { favorited: false }
    }
    await prisma.favorite.create({ data: { userId, editorProfileId: profile.id } })
    return { favorited: true }
  }

  /** IDs de userId dos editores favoritados — usado para marcar os cards da busca. */
  async listFavoritedUserIds(userId: string): Promise<string[]> {
    const favs = await prisma.favorite.findMany({
      where: { userId },
      select: { editorProfile: { select: { userId: true } } },
    })
    return favs.map((f) => f.editorProfile.userId)
  }

  /** Editores favoritados, com os dados que o card precisa. */
  async listForUser(userId: string) {
    const favs = await prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        editorProfile: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, bio: true } },
            categories: { include: { category: { select: { id: true, name: true } } } },
            portfolioItems: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: { id: true, title: true, thumbnailUrl: true, basePrice: true },
            },
          },
        },
      },
    })

    return favs.map((f) => {
      const e = f.editorProfile
      return {
        favoritedAt: f.createdAt,
        id: e.id,
        userId: e.user.id,
        name: e.user.name,
        avatarUrl: e.user.avatarUrl,
        bio: e.user.bio,
        isPremium: e.isPremium,
        avgRating: e.avgRating,
        totalJobs: e.totalJobs,
        categories: e.categories.map((ec) => ({ id: ec.category.id, name: ec.category.name })),
        portfolioPreview: e.portfolioItems.map((p) => ({
          id: p.id,
          title: p.title,
          thumbnailUrl: p.thumbnailUrl,
          basePrice: Number(p.basePrice),
        })),
      }
    })
  }
}

export const favoriteService = new FavoriteService()
