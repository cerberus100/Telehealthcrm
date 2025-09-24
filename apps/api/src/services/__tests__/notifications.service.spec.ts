/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma.service';
import { NotificationGateway } from '../../websocket/notification.gateway';
import { 
  createTestingModule, 
  mockClaims,
  createMockNotification 
} from '../../test/setup';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaService: PrismaService;
  let notificationGateway: NotificationGateway;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModule([
      NotificationsService,
      NotificationGateway,
    ]);

    service = module.get<NotificationsService>(NotificationsService);
    prismaService = module.get<PrismaService>(PrismaService);
    notificationGateway = module.get<NotificationGateway>(NotificationGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      const mockNotifications = [createMockNotification()];
      const claims = mockClaims();

      jest.spyOn(prismaService.notification, 'findMany').mockResolvedValue(mockNotifications);
      jest.spyOn(prismaService.notification, 'count').mockResolvedValue(1);

      const result = await service.getNotifications(
        { cursor: undefined, limit: 50 }, 
        claims
      );

      expect(result).toEqual({
        items: mockNotifications.map(n => ({
          id: n.id,
          type: n.type,
          created_at: n.createdAt.toISOString(),
          payload: n.payload,
        })),
        next_cursor: undefined,
      });
    });
  });

  describe('createNotification', () => {
    it('should create and send notification', async () => {
      const notificationData = {
        type: 'CONSULT_STATUS_CHANGE',
        targetUserId: 'user-123',
        payload: { consultId: 'consult-123', status: 'PASSED' },
      };
      const claims = mockClaims();
      const mockNotification = createMockNotification();

      jest.spyOn(prismaService.notification, 'create').mockResolvedValue(mockNotification);
      jest.spyOn(prismaService.notification, 'update').mockResolvedValue(mockNotification);
      jest.spyOn(notificationGateway, 'sendNotification').mockResolvedValue(undefined);

      const result = await service.createNotification(notificationData, claims);

      expect(result).toEqual(mockNotification);
      expect(prismaService.notification.create).toHaveBeenCalled();
      expect(notificationGateway.sendNotification).toHaveBeenCalled();
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'notification-123';
      const claims = mockClaims();
      const mockNotification = createMockNotification({ status: 'READ' });

      jest.spyOn(prismaService.notification, 'update').mockResolvedValue(mockNotification);

      const result = await service.markNotificationAsRead(notificationId, claims);

      expect(result).toEqual(mockNotification);
      expect(prismaService.notification.update).toHaveBeenCalledWith({
        where: { id: notificationId },
        data: { status: 'READ' },
      });
    });
  });

  describe('getNotificationStats', () => {
    it('should return notification statistics', async () => {
      const claims = mockClaims();

      jest.spyOn(prismaService.notification, 'count').mockResolvedValue(5);

      const result = await service.getNotificationStats(claims);

      expect(result).toEqual({
        total: 5,
        unread: 5,
        byType: [
          { type: 'CONSULT_STATUS_CHANGE', count: 2 },
          { type: 'LAB_RESULT_READY', count: 1 },
        ],
      });
    });
  });
});