import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { UpsOAuthService } from './ups-oauth.service'
import { UpsTrackingService } from './ups-tracking.service'
import { UpsPollingService } from './ups-polling.service'
import { PrismaService } from '../../prisma.service'

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    UpsOAuthService,
    UpsTrackingService,
    UpsPollingService,
    PrismaService,
  ],
  exports: [
    UpsOAuthService,
    UpsTrackingService,
    UpsPollingService,
  ],
})
export class UpsModule {}
