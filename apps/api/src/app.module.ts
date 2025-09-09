import { Module, MiddlewareConsumer } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
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
    ShipmentsController, 
    RxController, 
    NotificationsController,
    BusinessMetricsController,
    ComplianceController
  ],
  providers: [
    {
      provide: PrismaService,
      useClass: process.env.API_DEMO_MODE === 'true' ? (MockPrismaService as any) : PrismaService,
    },
    {
      provide: CognitoService,
      useClass: process.env.API_DEMO_MODE === 'true' ? (MockCognitoService as any) : CognitoService,
    },
    AuthService,
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
    {
      provide: APP_GUARD,
      useClass: AbacGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TelemetryInterceptor,
    },
  ],
})
export class AppModule {
  constructor(private readonly telemetryService: TelemetryService) {}

  async onModuleInit() {
    // Initialize telemetry service
    await this.telemetryService.initialize();
  }

  async onModuleDestroy() {
    // Shutdown telemetry service
    await this.telemetryService.shutdown();
  }

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtMiddleware, RbacMiddleware, TenantMiddleware, RateLimitMiddleware)
      .forRoutes('*')
      .apply(ClaimsMiddleware)
      .forRoutes('health') // Keep claims middleware for health endpoint only
  }
}