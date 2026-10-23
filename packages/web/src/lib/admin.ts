import { api } from './api'
import type { OrderStatus, TransactionStatus } from './orders'

export type UserRole = 'CREATOR' | 'EDITOR' | 'BOTH' | 'ADMIN'

// ─── Usuários ──────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  name: string
  email: string
  role: UserRole
  banned: boolean
  isPremium: boolean
  verified: boolean
  createdAt: string
}

interface ListUsersResponse {
  users: AdminUser[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function listUsers(params: { search?: string; role?: UserRole; page?: number }): Promise<ListUsersResponse> {
  const { data } = await api.get<ListUsersResponse>('/admin/users', { params })
  return data
}

export async function banUser(id: string): Promise<void> {
  await api.patch(`/admin/users/${id}/ban`)
}

/** Exclusão definitiva — só funciona fora de produção (a API recusa com 403 em produção) */
export async function deleteUserPermanently(id: string): Promise<void> {
  await api.delete(`/admin/users/${id}`)
}

export async function unbanUser(id: string): Promise<void> {
  await api.patch(`/admin/users/${id}/unban`)
}

export async function verifyEditor(id: string): Promise<void> {
  await api.patch(`/admin/editors/${id}/verify`)
}

export async function unverifyEditor(id: string): Promise<void> {
  await api.patch(`/admin/editors/${id}/unverify`)
}

// ─── Pedidos ───────────────────────────────────────────────────────────────────

export interface AdminOrder {
  id: string
  status: OrderStatus
  budget: number
  createdAt: string
  creatorName: string
  editorName: string
}

interface ListAdminOrdersResponse {
  orders: AdminOrder[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function listAdminOrders(params: { status?: OrderStatus; page?: number }): Promise<ListAdminOrdersResponse> {
  const { data } = await api.get<ListAdminOrdersResponse>('/admin/orders', { params })
  return data
}

// ─── Disputas ──────────────────────────────────────────────────────────────────

export interface AdminDispute {
  id: string
  reason: string
  status: 'OPEN' | 'RESOLVED_RELEASED' | 'RESOLVED_REFUNDED'
  createdAt: string
  order: {
    id: string
    title: string
    budget: number
    status: OrderStatus
    creatorName: string
    editorName: string
  }
}

export async function listAdminDisputes(): Promise<AdminDispute[]> {
  const { data } = await api.get<{ disputes: AdminDispute[] }>('/admin/disputes')
  return data.disputes
}

// ─── Financeiro ─────────────────────────────────────────────────────────────────

export interface FinancialSummary {
  totalTransacted: number
  totalPlatformFees: number
  totalHeldInEscrow: number
  totalRefunded: number
}

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const { data } = await api.get<FinancialSummary>('/admin/financial-summary')
  return data
}

export interface AdminTransaction {
  id: string
  orderId: string
  amount: number
  platformFee: number
  status: TransactionStatus
  createdAt: string
  payerName: string
  payeeName: string
}

interface ListTransactionsResponse {
  transactions: AdminTransaction[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function listAdminTransactions(params: { page?: number }): Promise<ListTransactionsResponse> {
  const { data } = await api.get<ListTransactionsResponse>('/admin/transactions', { params })
  return data
}

// ─── Auditoria ─────────────────────────────────────────────────────────────────

export type AuditEntityType =
  | 'Order'
  | 'Transaction'
  | 'Dispute'
  | 'Subscription'
  | 'User'
  | 'ProjectRequest'
  | 'RequestProposal'

export interface AuditLogEntry {
  id: string
  action: string
  entityType: AuditEntityType
  entityId: string
  metadata: Record<string, unknown> | null
  createdAt: string
  actor: { id: string; name: string; email: string } | null
}

interface ListAuditLogResponse {
  logs: AuditLogEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function listAuditLog(params: {
  entityType?: AuditEntityType
  action?: string
  actorSearch?: string
  orderId?: string
  page?: number
}): Promise<ListAuditLogResponse> {
  const { data } = await api.get<ListAuditLogResponse>('/admin/audit-log', { params })
  return data
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardTotals {
  newUsers: number
  ordersCreated: number
  ordersCompleted: number
  platformRevenue: number
  volume: number
}

export interface DashboardData {
  range: { from: string; to: string; days: number }
  current: DashboardTotals
  previous: DashboardTotals
  series: { date: string; users: number; orders: number; revenue: number }[]
  ordersByStatus: { status: OrderStatus; count: number }[]
  snapshot: {
    totalUsers: number
    activeOrders: number
    openDisputes: number
    heldInEscrow: number
    activeSubscribers: number
  }
  recentUsers: { id: string; name: string; email: string; role: UserRole; createdAt: string }[]
  recentOrders: {
    id: string
    title: string
    status: OrderStatus
    budget: number
    creatorName: string
    editorName: string
    createdAt: string
  }[]
}

export async function getDashboard(from: string, to: string): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>('/admin/dashboard', { params: { from, to } })
  return data
}
