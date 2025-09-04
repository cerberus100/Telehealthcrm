import { Module, MiddlewareConsumer } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AbacGuard } from './abac/abac.guard'
import { ClaimsMiddleware } from './middleware/claims.middleware'
import { HealthController } from './controllers/health.controller'
import { AuthController } from './controllers/auth.controller'
import { MeController } from './controllers/me.controller'
import { ConsultsController } from './controllers/consults.controller'
import { ShipmentsController } from './controllers/shipments.controller'
import { RxController } from './controllers/rx.controller'
import { NotificationsController } from './controllers/notifications.controller'
import { PrismaService } from './prisma.service'
import { MockPrismaService } from './mock-prisma.service'
import { AuthService } from './services/auth.service'
import { ConsultsService } from './services/consults.service'
import { ShipmentsService } from './services/shipments.service'
import { RxService } from './services/rx.service'
import { NotificationsService } from './services/notifications.service'

@Module({
  controllers: [
    HealthController, 
    AuthController, 
    MeController,
    ConsultsController, 
    ShipmentsController, 
    RxController, 
    NotificationsController
  ],
  providers: [
    {
      provide: PrismaService,
      useClass: process.env.API_DEMO_MODE === 'true' ? (MockPrismaService as any) : PrismaService,
    },
    AuthService,
    ConsultsService,
    ShipmentsService,
    RxService,
    NotificationsService,
    {
      provide: APP_GUARD,
      useClass: AbacGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClaimsMiddleware).forRoutes('*')
  }
}
