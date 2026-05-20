import { Prisma, OrderStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { NotFound, Forbidden, BadRequest } from '../lib/errors'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface OrderFileInput {
  fileUrl: string
  fileName: string
  fileType: string
}

export interface CreateOrderData {
  editorId: string
  categoryId: string
  portfolioItemId?: string
  title: string
  description: string
  budget: number
  deadline?: Date
  files: OrderFileInput[]
}

export interface ListOrdersParams {
  userId: string
  isAdmin: boolean
  role?: 'creator' | 'editor'
  status?: OrderStatus
  page?: number
  limit?: number
}

// 10% por enquanto — vai virar config ou tabela no futuro
const PLATFORM_FEE_RATE = 0.1

// ─── Includes reutilizáveis ──────────────────────────────────────────────────

const orderInclude = {
  category: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true, avatarUrl: true } },
  editor: { select: { id: true, name: true, avatarUrl: true } },
  files: true,
  _count: { select: { deliveries: true, revisions: true } },
} satisfies Prisma.OrderInclude

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class OrderService {
  /**
   * Cria uma Order. O creator vem do JWT; o editor é validado contra a base.
   * Os arquivos já chegam com URL do Cloudinary (signed upload feito no frontend).
   */
  async create(creatorId: string, data: CreateOrderData) {
    if (data.editorId === creatorId) {
      throw BadRequest('Você não pode criar um pedido para si mesmo')
    }
    if (data.budget <= 0) throw BadRequest('Orçamento deve ser positivo')

    const editor = await prisma.user.findUnique({
      where: { id: data.editorId },
      select: { id: true, role: true },
    })
    if (!editor) throw BadRequest('Editor não encontrado')
    if (editor.role !== 'EDITOR' && editor.role !== 'BOTH') {
      throw BadRequest('Usuário selecionado não é editor')
    }

    const category = await prisma.category.findUnique({ where: { id: data.categoryId } })
    if (!category) throw BadRequest('Categoria não encontrada')

    if (data.portfolioItemId) {
      const item = await prisma.portfolioItem.findUnique({
        where: { id: data.portfolioItemId },
        include: { editorProfile: true },
      })
      if (!item) throw BadRequest('Item de portfólio não encontrado')
      if (item.editorProfile.userId !== data.editorId) {
        throw BadRequest('Item de portfólio não pertence ao editor selecionado')
      }
    }

    const platformFee = Math.round(data.budget * PLATFORM_FEE_RATE * 100) / 100

    const order = await prisma.order.create({
      data: {
        creatorId,
        editorId: data.editorId,
        categoryId: data.categoryId,
        portfolioItemId: data.portfolioItemId,
        title: data.title.trim(),
        description: data.description.trim(),
        budget: data.budget,
        platformFee,
        deadline: data.deadline,
        status: 'PENDING',
        files: {
          create: data.files.map((f) => ({
            fileUrl: f.fileUrl,
            fileName: f.fileName,
            fileType: f.fileType,
          })),
        },
      },
      include: orderInclude,
    })

    return this.toDTO(order)
  }

  /**
   * Lista pedidos do usuário (creator ou editor). Admin enxerga tudo.
   * Filtros: ?role=creator|editor (default: ambos), ?status=...
   */
  async list(params: ListOrdersParams) {
    const page = Math.max(params.page ?? 1, 1)
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50)

    const where: Prisma.OrderWhereInput = {}

    if (params.role === 'creator') {
      where.creatorId = params.userId
    } else if (params.role === 'editor') {
      where.editorId = params.userId
    } else if (!params.isAdmin) {
      where.OR = [{ creatorId: params.userId }, { editorId: params.userId }]
    }

    if (params.status) where.status = params.status

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      }),
      prisma.order.count({ where }),
    ])

    return {
      orders: orders.map(this.toDTO),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async getById(id: string, userId: string, isAdmin: boolean) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    })
    if (!order) throw NotFound('Pedido não encontrado')

    if (!isAdmin && order.creatorId !== userId && order.editorId !== userId) {
      throw Forbidden('Você não tem acesso a este pedido')
    }
    return this.toDTO(order)
  }

  // ─── DTO ──────────────────────────────────────────────────────────────────

  private toDTO = (o: OrderWithRelations) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    status: o.status,
    budget: Number(o.budget),
    platformFee: Number(o.platformFee),
    deadline: o.deadline,
    category: o.category,
    creator: o.creator,
    editor: o.editor,
    files: o.files.map((f) => ({
      id: f.id,
      fileUrl: f.fileUrl,
      fileName: f.fileName,
      fileType: f.fileType,
      uploadedAt: f.uploadedAt,
    })),
    deliveriesCount: o._count.deliveries,
    revisionsCount: o._count.revisions,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  })
}
