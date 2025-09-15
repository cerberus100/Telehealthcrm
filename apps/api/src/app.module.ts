import { Module, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { AbacGuard } from './abac/abac.guard'
import { ClaimsMiddleware } from './middleware/claims.middleware'
import { JwtMiddleware } from './middleware/jwt.middleware'
import { RbacMiddleware } from './middleware/rbac.middleware'
import { RateLimitMiddleware } from './middleware/rate-limit.middleware'
import { TenantMiddleware } from './middleware/tenant.middleware'
import { HealthController } from './controllers/health.controller'
import { AuthController } from './controllers/auth.controller'
import { MeController } from './controllers/me.controller'
import { ConsultsController } from './controllers/consults.controller'
import { ShipmentsController } from './controllers/shipments.controller'
import { RxController } from './controllers/rx.controller'
import { NotificationsController } from './controllers/notifications.controller'
import { BusinessMetricsController } from './controllers/business-metrics.controller'
import { ComplianceController } from './controllers/compliance.controller'
import { PrismaService } from './prisma.service'
import { MockPrismaService } from './mock-prisma.service'
import { AuthService } from './services/auth.service'
import { CognitoService } from './auth/cognito.service'
import { MockCognitoService } from './auth/mock-cognito.service'
import { ConsultsService } from './services/consults.service'
import { ShipmentsService } from './services/shipments.service'
import { RxService } from './services/rx.service'
import { NotificationsService } from './services/notifications.service'
import { BusinessMetricsService } from './services/business-metrics.service'
import { SecurityAuditService } from './services/security-audit.service'
import { HIPAAComplianceService } from './services/hipaa-compliance.service'
import { SOC2ComplianceService } from './services/soc2-compliance.service'
import { AuditService } from './audit/audit.service'
import { TelemetryService } from './utils/telemetry.service'
import { TelemetryInterceptor } from './interceptors/telemetry.interceptor'
import { ShipmentsModule } from './modules/shipments/shipments.module'
import { UpsModule } from './integrations/ups/ups.module'
import { WebSocketModule } from './websocket/websocket.module'
import { AdminUsersModule } from './modules/admin/users/admin-users.module'
import { AdminOrganizationsModule } from './modules/admin/orgs/admin-organizations.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ShipmentsModule,
    UpsModule,
    WebSocketModule,
    AdminUsersModule,
    AdminOrganizationsModule,
  ],
  controllers: [
    HealthController, 
    AuthController, 
    MeController,
    ConsultsController, 
    RxController, 
    NotificationsController,
    BusinessMetricsController,
    ComplianceController
  ],
  providers: [
    {
      provide: PrismaService,
      useFactory: () => {
        const demoMode = process.env.API_DEMO_MODE === 'true';
        console.log('Creating PrismaService, demo mode:', demoMode);
        return demoMode ? new MockPrismaService() : new PrismaService();
      },
    },
    {
      provide: CognitoService,
      useFactory: () => {
        const demoMode = process.env.API_DEMO_MODE === 'true';
        console.log('Creating CognitoService, demo mode:', demoMode);
        return demoMode ? new MockCognitoService() : new CognitoService();
      },
    },
    ConsultsService,
    ShipmentsService,
    RxService,
    NotificationsService,
    BusinessMetricsService,
    SecurityAuditService,
    HIPAAComplianceService,
    SOC2ComplianceService,
    AuditService,
    TelemetryService,
    AuthService,
    // {
    //   provide: APP_GUARD,
    //   useClass: AbacGuard,
    // },
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: TelemetryInterceptor,
    // },
  ],
})
export class AppModule {
  // Remove explicit initialize/shutdown; TelemetryService handles lifecycle via OnModuleInit/Destroy

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtMiddleware, RbacMiddleware, TenantMiddleware, RateLimitMiddleware)
      .exclude('health', 'auth/(.*)')
      .forRoutes('*')
      .apply(ClaimsMiddleware)
      .forRoutes('health', 'auth/(.*)')
  }
}