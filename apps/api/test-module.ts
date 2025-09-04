import { Module, MiddlewareConsumer } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AbacGuard } from './src/abac/abac.guard'
import { ClaimsMiddleware } from './src/middleware/claims.middleware'
import { HealthController } from './src/controllers/health.controller'
import { AuthController } from './src/controllers/auth.controller'
import { ConsultsController } from './src/controllers/consults.controller'
import { ShipmentsController } from './src/controllers/shipments.controller'
import { RxController } from './src/controllers/rx.controller'
import { NotificationsController } from './src/controllers/notifications.controller'
import { MockPrismaService } from './src/mock-prisma.service'
import { AuthService } from './src/services/auth.service'
import { ConsultsService } from './src/services/consults.service'
import { ShipmentsService } from './src/services/shipments.service'
import { RxService } from './src/services/rx.service'
import { NotificationsService } from './src/services/notifications.service'

@Module({
  controllers: [
    HealthController, 
    AuthController, 
    ConsultsController, 
    ShipmentsController, 
    RxController, 
    NotificationsController
  ],
  providers: [
    MockPrismaService,
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
export class TestAppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClaimsMiddleware).forRoutes('*')
  }
}
