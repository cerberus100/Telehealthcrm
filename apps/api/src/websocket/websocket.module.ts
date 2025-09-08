import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationGateway } from './notification.gateway';
import { NotificationsService } from '../services/notifications.service';

@Module({
  imports: [ConfigModule],
  providers: [NotificationGateway, NotificationsService],
  exports: [NotificationGateway],
})
export class WebSocketModule {}
