import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationGateway } from './notification.gateway';
import { NotificationsService } from '../services/notifications.service';
import { CognitoService } from '../auth/cognito.service';

@Module({
  imports: [ConfigModule],
  providers: [NotificationGateway, NotificationsService, CognitoService],
  exports: [NotificationGateway],
})
export class WebSocketModule {}
