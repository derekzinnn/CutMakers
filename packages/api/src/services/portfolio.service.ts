import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface CreatePortfolioData {
  title: string
  description?: string
  categoryId?: string
  /** Categoria livre (opção "Outros") — find-or-create por nome */
  categoryName?: string
  videoUrl: string
  thumbnailUrl?: string
  basePrice: number
}

export interface UpdatePortfolioData {
  title?: string
  description?: string
  categoryId?: string
  categoryName?: string
  videoUrl?: string
  thumbnailUrl?: string
  basePrice?: number
}

export interface ListPortfolioParams {
  editorUserId?: string
  categoryId?: string
  page?: number
  limit?: number
}

// ─── Includes reutilizáveis ──────────────────────────────────────────────────

const itemInclude = {
  category: { select: { id: true, name: true } },
  editorProfile: {
    select: {
      id: true,
      userId: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.PortfolioItemInclude

type ItemWithRelations = Prisma.PortfolioItemGetPayload<{ include: typeof itemInclude }>

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class PortfolioService {
  /**
   * Resolve o categoryId a partir de um id existente OU de um nome livre
   * (opção "Outros" no form). Nomes são normalizados e reutilizados
   * case-insensitive para não duplicar categorias.
   */
  private async resolveCategoryId(categoryId?: string, categoryName?: string): Promise<string> {
    if (categoryId) {
      const category = await prisma.category.findUnique({ where: { id: categoryId } })
      if (!category) throw BadRequest('Categoria não encontrada')
      return category.id
    }

    const name = categoryName?.trim()
    if (!name) throw BadRequest('Informe uma categoria')

    const existing = await prisma.category.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    })
    if (existing) return existing.id

    const created = await prisma.category.create({ data: { name } })
    return created.id
  }

  /**
   * Lista itens de portfólio. Filtros opcionais por editor e/ou categoria.
   * Endpoint público — qualquer um (logado ou não) pode chamar.
   */
  async list(params: ListPortfolioParams) {
    const page = Math.max(params.page ?? 1, 1)
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50)

    const where: Prisma.PortfolioItemWhereInput = {}
    if (params.editorUserId) {
      where.editorProfile = { userId: params.editorUserId }
    }
    if (params.categoryId) {
      where.categoryId = params.categoryId
    }

    const [items, total] = await Promise.all([
      prisma.portfolioItem.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: itemInclude,
      }),
      prisma.portfolioItem.count({ where }),
    ])

    return {
      items: items.map(this.toDTO),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getById(id: string) {
    const item = await prisma.portfolioItem.findUnique({
      where: { id },
      include: itemInclude,
    })
    if (!item) throw NotFound('Item de portfólio não encontrado')
    return this.toDTO(item)
  }

  /**
   * Cria um item. Auto-cria EditorProfile se o usuário (com role EDITOR/BOTH)
   * ainda não tiver — útil quando admin promove alguém para EDITOR.
   */
  async create(userId: string, data: CreatePortfolioData) {
    // garante EditorProfile
    let profile = await prisma.editorProfile.findUnique({ where: { userId } })
    if (!profile) {
      profile = await prisma.editorProfile.create({ data: { userId } })
    }

    // resolve categoria (id existente ou nome livre — "Outros")
    const categoryId = await this.resolveCategoryId(data.categoryId, data.categoryName)

    if (data.basePrice <= 0) throw BadRequest('basePrice deve ser maior que zero')

    const item = await prisma.portfolioItem.create({
      data: {
        editorProfileId: profile.id,
        categoryId,
        title: data.title,
        description: data.description,
        videoUrl: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl,
        basePrice: data.basePrice,
      },
      include: itemInclude,
    })

    return this.toDTO(item)
  }

  /**
   * Atualiza um item. Checa ownership (ou admin).
   */
  async update(itemId: string, userId: string, isAdmin: boolean, data: UpdatePortfolioData) {
    const existing = await prisma.portfolioItem.findUnique({
      where: { id: itemId },
      include: { editorProfile: true },
    })
    if (!existing) throw NotFound('Item de portfólio não encontrado')

    if (!isAdmin && existing.editorProfile.userId !== userId) {
      throw Forbidden('Você não pode editar este item')
    }

    // resolve categoria se enviada (id existente ou nome livre — "Outros")
    let resolvedCategoryId: string | undefined
    if (data.categoryId || data.categoryName) {
      resolvedCategoryId = await this.resolveCategoryId(data.categoryId, data.categoryName)
    }

    if (data.basePrice !== undefined && data.basePrice <= 0) {
      throw BadRequest('basePrice deve ser maior que zero')
    }

    const item = await prisma.portfolioItem.update({
      where: { id: itemId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(resolvedCategoryId !== undefined && { categoryId: resolvedCategoryId }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
        ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl }),
        ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
      },
      include: itemInclude,
    })

    return this.toDTO(item)
  }

  /**
   * Remove um item. Checa ownership (ou admin).
   * Bloqueia exclusão se houver Order vinculada (proteção de integridade).
   */
  async delete(itemId: string, userId: string, isAdmin: boolean) {
    const existing = await prisma.portfolioItem.findUnique({
      where: { id: itemId },
      include: {
        editorProfile: true,
        _count: { select: { orders: true } },
      },
    })
    if (!existing) throw NotFound('Item de portfólio não encontrado')

    if (!isAdmin && existing.editorProfile.userId !== userId) {
      throw Forbidden('Você não pode remover este item')
    }

    if (existing._count.orders > 0) {
      throw BadRequest('Este item tem pedidos vinculados e não pode ser removido')
    }

    await prisma.portfolioItem.delete({ where: { id: itemId } })
  }

  // ─── DTO ──────────────────────────────────────────────────────────────────

  private toDTO = (item: ItemWithRelations) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    videoUrl: item.videoUrl,
    thumbnailUrl: item.thumbnailUrl,
    basePrice: Number(item.basePrice),
    category: item.category,
    editor: {
      id: item.editorProfile.user.id,
      name: item.editorProfile.user.name,
      avatarUrl: item.editorProfile.user.avatarUrl,
    },
    createdAt: item.createdAt,
  })
}
