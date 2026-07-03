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

export async function unbanUser(id: string): Promise<void> {
  await api.patch(`/admin/users/${id}/unban`)
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
