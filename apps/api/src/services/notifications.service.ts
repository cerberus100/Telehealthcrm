import { Injectable, Logger } from '@nestjs/common'
import { BaseService } from './base.service'
import { RequestClaims } from '../types/claims'
import { NotificationsQueryDto, NotificationDto } from '../types/dto'
import { NotificationGateway } from '../websocket/notification.gateway'
import { z } from 'zod'

// Notification creation schema
const CreateNotificationSchema = z.object({
  type: z.enum(['CONSULT_STATUS_CHANGE', 'SHIPMENT_UPDATE', 'RX_STATUS_CHANGE', 'SYSTEM_ALERT', 'USER_MANAGEMENT']),
  targetUserId: z.string().optional(),
  targetOrgId: z.string().optional(),
  payload: z.record(z.any()),
})

@Injectable()
export class NotificationsService extends BaseService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private notificationGateway: NotificationGateway,
  ) {
    super(null as any) // Pass null for now since we don't need Prisma in this service
  }

  async getNotifications(query: NotificationsQueryDto, claims: RequestClaims) {
    const where: any = {
      orgId: claims.orgId,
    }

    // Add user-specific filtering if needed
    if (claims.role !== 'ADMIN') {
      where.OR = [
        { targetUserId: claims.sub },
        { targetUserId: null }, // Organization-wide notifications
      ]
    }

    const take = query.limit || 50

    const notifications = await this.prisma.notification.findMany({
      where,
      take: take + 1,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    })

    const itemsResponse = notifications.map((notification: any) => ({
      id: notification.id,
      type: notification.type,
      created_at: notification.createdAt.toISOString(),
      payload: notification.payload as any,
    }))

    return this.createPaginatedResponse(
      itemsResponse,
      take,
      (item) => item.id
    )
  }

  async createNotification(data: {
    type: string;
    targetUserId?: string;
    targetOrgId?: string;
    payload: Record<string, any>;
  }, claims: RequestClaims) {
    try {
      // Validate input
      const validationResult = CreateNotificationSchema.safeParse(data);
      if (!validationResult.success) {
        throw new Error(`Invalid notification data: ${validationResult.error.message}`);
      }

      const { type, targetUserId, targetOrgId, payload } = validationResult.data;

      // Determine target organization
      const orgId = targetOrgId || claims.orgId;

      // Create notification in database
      const notification = await this.prisma.notification.create({
        data: {
          orgId,
          type,
          targetUserId,
          targetOrgId,
          payload,
          status: 'PENDING',
        },
      });

      this.logger.log(`Notification created: ${notification.id} (type: ${type}, org: ${orgId})`);

      // Send real-time notification via WebSocket
      await this.notificationGateway.sendNotification({
        type,
        targetUserId,
        targetOrgId,
        payload,
      });

      // Update status to delivered
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'DELIVERED' },
      });

      return notification;

    } catch (error) {
      this.logger.error('Error creating notification:', error);
      throw error;
    }
  }

  async createSystemNotification(type: string, payload: Record<string, any>) {
    try {
      // Create system-wide notification
      const notification = await this.prisma.notification.create({
        data: {
          orgId: 'system', // Special org ID for system notifications
          type,
          payload,
          status: 'PENDING',
        },
      });

      this.logger.log(`System notification created: ${notification.id} (type: ${type})`);

      // Broadcast to all connected clients
      await this.notificationGateway.broadcastSystemNotification(type, payload);

      // Update status to delivered
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'DELIVERED' },
      });

      return notification;

    } catch (error) {
      this.logger.error('Error creating system notification:', error);
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: string, claims: RequestClaims) {
    try {
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          orgId: claims.orgId,
          OR: [
            { targetUserId: claims.sub },
            { targetUserId: null },
          ],
        },
      });

      if (!notification) {
        throw new Error('Notification not found or access denied');
      }

      const updatedNotification = await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'READ' },
      });

      this.logger.log(`Notification marked as read: ${notificationId} by user ${claims.sub}`);

      return updatedNotification;

    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async getNotificationStats(claims: RequestClaims) {
    try {
      const where: any = {
        orgId: claims.orgId,
      };

      if (claims.role !== 'ADMIN') {
        where.OR = [
          { targetUserId: claims.sub },
          { targetUserId: null },
        ];
      }

      const [total, unread, byType] = await Promise.all([
        this.prisma.notification.count({ where }),
        this.prisma.notification.count({ 
          where: { ...where, status: 'PENDING' } 
        }),
        this.prisma.notification.groupBy({
          by: ['type'],
          where,
          _count: { type: true },
        }),
      ]);

      return {
        total,
        unread,
        byType: byType.map((item: { type: string; _count: { type: number } }) => ({
          type: item.type,
          count: item._count.type,
        })),
      };

    } catch (error) {
      this.logger.error('Error getting notification stats:', error);
      throw error;
    }
  }

  // Helper method to create notifications for specific events
  async notifyConsultStatusChange(consultId: string, oldStatus: string, newStatus: string, claims: RequestClaims) {
    await this.createNotification({
      type: 'CONSULT_STATUS_CHANGE',
      payload: {
        consultId,
        oldStatus,
        newStatus,
        changedBy: claims.sub,
        changedAt: new Date().toISOString(),
      },
    }, claims);
  }

  async notifyShipmentUpdate(shipmentId: string, status: string, trackingNumber: string, claims: RequestClaims) {
    await this.createNotification({
      type: 'SHIPMENT_UPDATE',
      payload: {
        shipmentId,
        status,
        trackingNumber,
        updatedBy: claims.sub,
        updatedAt: new Date().toISOString(),
      },
    }, claims);
  }

  async notifyRxStatusChange(rxId: string, oldStatus: string, newStatus: string, claims: RequestClaims) {
    await this.createNotification({
      type: 'RX_STATUS_CHANGE',
      payload: {
        rxId,
        oldStatus,
        newStatus,
        changedBy: claims.sub,
        changedAt: new Date().toISOString(),
      },
    }, claims);
  }
}
