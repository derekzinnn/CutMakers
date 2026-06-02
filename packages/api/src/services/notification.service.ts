import { prisma } from '../lib/prisma'
import { Forbidden, NotFound } from '../lib/errors'

export class NotificationService {
  async listForUser(userId: string, limit = 30) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        readAt: true,
        relatedOrderId: true,
        createdAt: true,
      },
    })
  }

  async countUnread(userId: string) {
    return prisma.notification.count({ where: { userId, readAt: null } })
  }

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
  }

  async markOneRead(id: string, userId: string) {
    const notif = await prisma.notification.findUnique({ where: { id } })
    if (!notif) throw NotFound('Notificação não encontrada')
    if (notif.userId !== userId) throw Forbidden('Sem permissão')
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } })
  }
}

export const notificationService = new NotificationService()
