import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { RequestClaims } from '../types/claims'
import { NotificationsQueryDto, NotificationDto } from '../types/dto'

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getNotifications(query: NotificationsQueryDto, claims: RequestClaims) {
    const where: any = {
      orgId: claims.orgId,
    }

    const take = query.limit || 50

    const notifications = await this.prisma.notification.findMany({
      where,
      take: take + 1,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    })

    const hasNext = notifications.length > take
    const items = notifications.slice(0, take)

    const itemsResponse = items.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      created_at: notification.createdAt.toISOString(),
      payload: notification.payload as any,
    }))

    const last = items.length > 0 ? items[items.length - 1] : null
    return {
      items: itemsResponse,
      next_cursor: hasNext && last ? last.id : null,
    }
  }
}
