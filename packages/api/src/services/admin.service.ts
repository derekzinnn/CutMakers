import { OrderStatus, Prisma, Role } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { BadRequest, NotFound } from '../lib/errors'

// ─── Tipos de parâmetros ───────────────────────────────────────────────────────

export interface ListUsersParams {
  search?: string
  role?: Role
  page?: number
}

export interface ListAdminOrdersParams {
  status?: OrderStatus
  page?: number
}

const USERS_PER_PAGE = 20
const ORDERS_PER_PAGE = 20
const TRANSACTIONS_PER_PAGE = 50

// ─── Serviço ──────────────────────────────────────────────────────────────────

export class AdminService {
  async listUsers(params: ListUsersParams) {
    const page = Math.max(params.page ?? 1, 1)
    const skip = (page - 1) * USERS_PER_PAGE

    const where: Prisma.UserWhereInput = {}
    if (params.role) where.role = params.role
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: USERS_PER_PAGE,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          banned: true,
          createdAt: true,
          editorProfile: { select: { isPremium: true } },
        },
      }),
      prisma.user.count({ where }),
    ])

    return {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        banned: u.banned,
        isPremium: u.editorProfile?.isPremium ?? false,
        createdAt: u.createdAt,
      })),
      total,
      page,
      limit: USERS_PER_PAGE,
      totalPages: Math.ceil(total / USERS_PER_PAGE),
    }
  }

  async setBanned(userId: string, banned: boolean) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!user) throw NotFound('Usuário não encontrado')
    if (user.role === 'ADMIN') throw BadRequest('Não é possível banir um administrador')

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { banned },
      select: { id: true, name: true, email: true, role: true, banned: true },
    })
    return updated
  }

  async listOrders(params: ListAdminOrdersParams) {
    const page = Math.max(params.page ?? 1, 1)
    const skip = (page - 1) * ORDERS_PER_PAGE

    const where: Prisma.OrderWhereInput = {}
    if (params.status) where.status = params.status

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: ORDERS_PER_PAGE,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          budget: true,
          createdAt: true,
          creator: { select: { name: true } },
          editor: { select: { name: true } },
        },
      }),
      prisma.order.count({ where }),
    ])

    return {
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        budget: Number(o.budget),
        createdAt: o.createdAt,
        creatorName: o.creator.name,
        editorName: o.editor.name,
      })),
      total,
      page,
      limit: ORDERS_PER_PAGE,
      totalPages: Math.ceil(total / ORDERS_PER_PAGE),
    }
  }

  async listOpenDisputes() {
    const disputes = await prisma.dispute.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            title: true,
            budget: true,
            status: true,
            creator: { select: { name: true } },
            editor: { select: { name: true } },
          },
        },
      },
    })

    return disputes.map((d) => ({
      id: d.id,
      reason: d.reason,
      status: d.status,
      createdAt: d.createdAt,
      order: {
        id: d.order.id,
        title: d.order.title,
        budget: Number(d.order.budget),
        status: d.order.status,
        creatorName: d.order.creator.name,
        editorName: d.order.editor.name,
      },
    }))
  }

  async financialSummary() {
    const [released, held, refunded] = await Promise.all([
      prisma.transaction.aggregate({
        where: { status: 'RELEASED' },
        _sum: { amount: true, platformFee: true },
      }),
      prisma.transaction.aggregate({
        where: { status: 'HELD' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { status: 'REFUNDED' },
        _sum: { amount: true },
      }),
    ])

    return {
      totalTransacted: Number(released._sum.amount ?? 0),
      totalPlatformFees: Number(released._sum.platformFee ?? 0),
      totalHeldInEscrow: Number(held._sum.amount ?? 0),
      totalRefunded: Number(refunded._sum.amount ?? 0),
    }
  }

  async listTransactions(params: { page?: number }) {
    const page = Math.max(params.page ?? 1, 1)
    const skip = (page - 1) * TRANSACTIONS_PER_PAGE

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        skip,
        take: TRANSACTIONS_PER_PAGE,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderId: true,
          amount: true,
          platformFee: true,
          status: true,
          createdAt: true,
          payer: { select: { name: true } },
          payee: { select: { name: true } },
        },
      }),
      prisma.transaction.count(),
    ])

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        orderId: t.orderId,
        amount: Number(t.amount),
        platformFee: Number(t.platformFee),
        status: t.status,
        createdAt: t.createdAt,
        payerName: t.payer.name,
        payeeName: t.payee.name,
      })),
      total,
      page,
      limit: TRANSACTIONS_PER_PAGE,
      totalPages: Math.ceil(total / TRANSACTIONS_PER_PAGE),
    }
  }
}

export const adminService = new AdminService()
