import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface ListEditorsParams {
  category?: string
  search?: string
  premium?: boolean
  page?: number
  limit?: number
}

export interface UpdateMyProfileData {
  name?: string
  bio?: string
  avatarUrl?: string
  categoryIds?: string[]
}

// ─── Includes reutilizáveis (tipados pelo Prisma) ─────────────────────────────

const listInclude = {
  user: {
    select: { id: true, name: true, avatarUrl: true, bio: true, createdAt: true },
  },
  categories: { include: { category: true } },
  portfolioItems: {
    take: 3,
    select: { id: true, title: true, thumbnailUrl: true, basePrice: true },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.EditorProfileInclude

const fullInclude = {
  user: {
    select: {
      id: true, name: true, email: true, role: true,
      avatarUrl: true, bio: true, createdAt: true,
    },
  },
  categories: { include: { category: true } },
  portfolioItems: {
    include: { category: true },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.EditorProfileInclude

type EditorListItem = Prisma.EditorProfileGetPayload<{ include: typeof listInclude }>
type EditorFull = Prisma.EditorProfileGetPayload<{ include: typeof fullInclude }>

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class EditorService {
  /**
   * Lista editores (público). Suporta filtros e paginação.
   * Ordem: premium primeiro, depois rating, depois total de jobs.
   */
  async listEditors(params: ListEditorsParams) {
    const page = Math.max(params.page ?? 1, 1)
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50)
    const skip = (page - 1) * limit

    const where: Prisma.EditorProfileWhereInput = {}

    if (params.category) {
      where.categories = {
        some: {
          category: {
            OR: [
              { id: params.category },
              { name: { equals: params.category, mode: 'insensitive' } },
            ],
          },
        },
      }
    }

    if (params.search) {
      where.user = { name: { contains: params.search, mode: 'insensitive' } }
    }

    if (params.premium) {
      where.isPremium = true
    }

    const [editors, total] = await Promise.all([
      prisma.editorProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isPremium: 'desc' },
          { avgRating: 'desc' },
          { totalJobs: 'desc' },
        ],
        include: listInclude,
      }),
      prisma.editorProfile.count({ where }),
    ])

    return {
      editors: editors.map(this.toListDTO),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Busca um editor pelo userId (rota pública de perfil).
   */
  async getEditorByUserId(userId: string) {
    const editor = await prisma.editorProfile.findUnique({
      where: { userId },
      include: fullInclude,
    })

    if (!editor) return null
    return this.toFullDTO(editor)
  }

  /**
   * Atualiza o perfil do editor logado. Cria EditorProfile se não existir.
   * Roda em transação para garantir consistência entre User e EditorProfile.
   */
  async updateMyProfile(userId: string, data: UpdateMyProfileData) {
    // Garante que existe um EditorProfile
    let profile = await prisma.editorProfile.findUnique({ where: { userId } })
    if (!profile) {
      profile = await prisma.editorProfile.create({ data: { userId } })
    }

    // Valida categorias se enviadas
    if (data.categoryIds && data.categoryIds.length > 0) {
      const valid = await prisma.category.findMany({
        where: { id: { in: data.categoryIds } },
        select: { id: true },
      })
      if (valid.length !== data.categoryIds.length) {
        throw new Error('Uma ou mais categorias não existem')
      }
    }

    await prisma.$transaction(async (tx) => {
      // Atualiza campos do User
      const userUpdate: Prisma.UserUpdateInput = {}
      if (data.name !== undefined) userUpdate.name = data.name
      if (data.bio !== undefined) userUpdate.bio = data.bio
      if (data.avatarUrl !== undefined) {
        userUpdate.avatarUrl = data.avatarUrl === '' ? null : data.avatarUrl
      }

      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({ where: { id: userId }, data: userUpdate })
      }

      // Substitui categorias (delete + recreate)
      if (data.categoryIds) {
        await tx.editorCategory.deleteMany({ where: { editorProfileId: profile!.id } })
        if (data.categoryIds.length > 0) {
          await tx.editorCategory.createMany({
            data: data.categoryIds.map((categoryId) => ({
              editorProfileId: profile!.id,
              categoryId,
            })),
          })
        }
      }
    })

    return this.getEditorByUserId(userId)
  }

  // ─── DTOs (formatadores) ────────────────────────────────────────────────────

  private toListDTO = (editor: EditorListItem) => ({
    id: editor.id,
    userId: editor.userId,
    name: editor.user.name,
    avatarUrl: editor.user.avatarUrl,
    bio: editor.user.bio,
    isPremium: editor.isPremium,
    avgRating: editor.avgRating,
    totalJobs: editor.totalJobs,
    categories: editor.categories.map((ec) => ({
      id: ec.category.id,
      name: ec.category.name,
    })),
    portfolioPreview: editor.portfolioItems.map((p) => ({
      id: p.id,
      title: p.title,
      thumbnailUrl: p.thumbnailUrl,
      basePrice: Number(p.basePrice),
    })),
  })

  private toFullDTO = (editor: EditorFull) => ({
    id: editor.user.id,
    name: editor.user.name,
    email: editor.user.email,
    role: editor.user.role,
    avatarUrl: editor.user.avatarUrl,
    bio: editor.user.bio,
    createdAt: editor.user.createdAt,
    profile: {
      id: editor.id,
      isPremium: editor.isPremium,
      premiumExpiresAt: editor.premiumExpiresAt,
      avgRating: editor.avgRating,
      totalJobs: editor.totalJobs,
      categories: editor.categories.map((ec) => ({
        id: ec.category.id,
        name: ec.category.name,
      })),
      portfolioItems: editor.portfolioItems.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        videoUrl: p.videoUrl,
        thumbnailUrl: p.thumbnailUrl,
        basePrice: Number(p.basePrice),
        category: { id: p.category.id, name: p.category.name },
        createdAt: p.createdAt,
      })),
    },
  })
}
