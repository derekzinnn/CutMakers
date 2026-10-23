import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { BadRequest } from '../lib/errors'

/**
 * Dashboard do admin: métricas de um PERÍODO (from..to, inclusive) comparadas com o período
 * anterior de mesmo tamanho, mais uma série diária para o gráfico.
 *
 * Os dias são do fuso de Brasília (UTC-3, sem horário de verão desde 2019): "1º de outubro"
 * começa às 00:00 -03:00, não às 00:00 UTC — senão pedidos feitos à noite caem no dia seguinte.
 */

const TZ_OFFSET = '-03:00'
const TZ_NAME = 'America/Sao_Paulo'
const DAY_MS = 24 * 60 * 60 * 1000
export const MAX_RANGE_DAYS = 366

export interface DateRange {
  /** Início (inclusive) */
  start: Date
  /** Fim (EXCLUSIVO): meia-noite do dia seguinte ao último dia do período */
  end: Date
  days: number
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function parseRange(from: string, to: string): DateRange {
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) throw BadRequest('Datas devem estar no formato AAAA-MM-DD')
  const start = new Date(`${from}T00:00:00${TZ_OFFSET}`)
  const last = new Date(`${to}T00:00:00${TZ_OFFSET}`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(last.getTime())) throw BadRequest('Data inválida')
  if (last < start) throw BadRequest('A data final não pode ser anterior à inicial')
  const days = Math.round((last.getTime() - start.getTime()) / DAY_MS) + 1
  if (days > MAX_RANGE_DAYS) throw BadRequest(`Período máximo de ${MAX_RANGE_DAYS} dias`)
  return { start, end: new Date(last.getTime() + DAY_MS), days }
}

/** Período imediatamente anterior, com o mesmo número de dias */
export function previousRange(r: DateRange): DateRange {
  return { start: new Date(r.start.getTime() - r.days * DAY_MS), end: r.start, days: r.days }
}

/** 'AAAA-MM-DD' de cada dia do período (fuso de Brasília) */
export function listDays(r: DateRange): string[] {
  const out: string[] = []
  for (let i = 0; i < r.days; i++) {
    // meio-dia evita qualquer borda de fuso ao formatar
    const d = new Date(r.start.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000)
    out.push(d.toLocaleDateString('en-CA', { timeZone: TZ_NAME }))
  }
  return out
}

interface PeriodTotals {
  newUsers: number
  ordersCreated: number
  ordersCompleted: number
  platformRevenue: number
  volume: number
}

async function totalsFor(r: DateRange): Promise<PeriodTotals> {
  const [newUsers, ordersCreated, ordersCompleted, released] = await Promise.all([
    prisma.user.count({ where: { personaOfId: null, createdAt: { gte: r.start, lt: r.end } } }),
    prisma.order.count({ where: { createdAt: { gte: r.start, lt: r.end } } }),
    prisma.order.count({ where: { status: 'COMPLETED', updatedAt: { gte: r.start, lt: r.end } } }),
    // RELEASED é estado terminal: updatedAt = momento da liberação
    prisma.transaction.aggregate({
      where: { status: 'RELEASED', updatedAt: { gte: r.start, lt: r.end } },
      _sum: { amount: true, platformFee: true },
    }),
  ])
  return {
    newUsers,
    ordersCreated,
    ordersCompleted,
    platformRevenue: Number(released._sum.platformFee ?? 0),
    volume: Number(released._sum.amount ?? 0),
  }
}

type DayRow = { d: string; n: number; v: Prisma.Decimal | number | null }

async function dailySeries(r: DateRange) {
  const [users, orders, revenue] = await Promise.all([
    prisma.$queryRaw<DayRow[]>`
      SELECT to_char(("createdAt" AT TIME ZONE ${TZ_NAME})::date, 'YYYY-MM-DD') AS d, count(*)::int AS n, NULL AS v
      FROM "User" WHERE "personaOfId" IS NULL AND "createdAt" >= ${r.start} AND "createdAt" < ${r.end} GROUP BY 1`,
    prisma.$queryRaw<DayRow[]>`
      SELECT to_char(("createdAt" AT TIME ZONE ${TZ_NAME})::date, 'YYYY-MM-DD') AS d, count(*)::int AS n, NULL AS v
      FROM "Order" WHERE "createdAt" >= ${r.start} AND "createdAt" < ${r.end} GROUP BY 1`,
    prisma.$queryRaw<DayRow[]>`
      SELECT to_char(("updatedAt" AT TIME ZONE ${TZ_NAME})::date, 'YYYY-MM-DD') AS d, count(*)::int AS n, sum("platformFee") AS v
      FROM "Transaction" WHERE status = 'RELEASED' AND "updatedAt" >= ${r.start} AND "updatedAt" < ${r.end} GROUP BY 1`,
  ])
  const u = new Map(users.map((x) => [x.d, x.n]))
  const o = new Map(orders.map((x) => [x.d, x.n]))
  const rv = new Map(revenue.map((x) => [x.d, Number(x.v ?? 0)]))
  return listDays(r).map((date) => ({
    date,
    users: u.get(date) ?? 0,
    orders: o.get(date) ?? 0,
    revenue: rv.get(date) ?? 0,
  }))
}

const ACTIVE_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'NEGOTIATING',
  'AWAITING_PAYMENT',
  'IN_PROGRESS',
  'DELIVERED',
  'REVISION_REQUESTED',
  'DISPUTED',
] as const

export async function getDashboard(from: string, to: string) {
  const range = parseRange(from, to)
  const prev = previousRange(range)

  const [current, previous, series, byStatus, snapshot, recentUsers, recentOrders] = await Promise.all([
    totalsFor(range),
    totalsFor(prev),
    dailySeries(range),
    prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: range.start, lt: range.end } },
      _count: { _all: true },
    }),
    Promise.all([
      prisma.user.count({ where: { personaOfId: null } }),
      prisma.order.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),
      prisma.dispute.count({ where: { status: 'OPEN' } }),
      prisma.transaction.aggregate({ where: { status: 'HELD' }, _sum: { amount: true } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    ]),
    prisma.user.findMany({
      where: { personaOfId: null, createdAt: { gte: range.start, lt: range.end } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: range.start, lt: range.end } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        budget: true,
        createdAt: true,
        creator: { select: { name: true } },
        editor: { select: { name: true } },
      },
    }),
  ])

  const [totalUsers, activeOrders, openDisputes, held, activeSubscribers] = snapshot

  return {
    range: { from, to, days: range.days },
    current,
    previous,
    series,
    ordersByStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
    snapshot: {
      totalUsers,
      activeOrders,
      openDisputes,
      heldInEscrow: Number(held._sum.amount ?? 0),
      activeSubscribers,
    },
    recentUsers: recentUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      title: o.title,
      status: o.status,
      budget: Number(o.budget),
      creatorName: o.creator.name,
      editorName: o.editor.name,
      createdAt: o.createdAt.toISOString(),
    })),
  }
}
