import { Module, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { AbacGuard } from './abac/abac.guard'
import { ClaimsMiddleware } from './middleware/claims.middleware'
import { JwtMiddleware } from './middleware/jwt.middleware'
import { RbacMiddleware } from './middleware/rbac.middleware'
import { HealthController } from './controllers/health.controller'
import { AuthController } from './controllers/auth.controller'
import { ConsultsController } from './controllers/consults.controller'
import { ShipmentsController } from './controllers/shipments.controller'
import { RxController } from './controllers/rx.controller'
import { NotificationsController } from './controllers/notifications.controller'
import { PrismaService } from './prisma.service'
import { AuthService } from './services/auth.service'
import { CognitoService } from './auth/cognito.service'
import { ConsultsService } from './services/consults.service'
import { ShipmentsService } from './services/shipments.service'
import { RxService } from './services/rx.service'
import { NotificationsService } from './services/notifications.service'
import { AuditService } from './audit/audit.service'
import { ShipmentsModule } from './modules/shipments/shipments.module'
import { UpsModule } from './integrations/ups/ups.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ShipmentsModule,
    UpsModule,
  ],
  controllers: [
    HealthController, 
    AuthController, 
    ConsultsController, 
    ShipmentsController, 
    RxController, 
    NotificationsController
  ],
  providers: [
    PrismaService,
    CognitoService,
    AuthService,
    ConsultsService,
    ShipmentsService,
    RxService,
    NotificationsService,
    AuditService,
    {
      provide: APP_GUARD,
      useClass: AbacGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtMiddleware, RbacMiddleware)
      .forRoutes('*')
      .apply(ClaimsMiddleware)
      .forRoutes('health') // Keep claims middleware for health endpoint only
  }
}
