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
import { AuthService } from './services/auth.service'
import { CognitoService } from './auth/cognito.service'
import { ConsultsService } from './services/consults.service'
import { ShipmentsService } from './services/shipments.service'
import { RxService } from './services/rx.service'
import { NotificationsService } from './services/notifications.service'
import { BusinessMetricsService } from './services/business-metrics.service'
import { SecurityAuditService } from './services/security-audit.service'
import { HIPAAComplianceService } from './services/hipaa-compliance.service'
import { SOC2ComplianceService } from './services/soc2-compliance.service'
import { AuditService } from './audit/audit.service'
import { ShipmentsModule } from './modules/shipments/shipments.module'
import { UpsModule } from './integrations/ups/ups.module'
import { WebSocketModule } from './websocket/websocket.module'
import { AdminUsersModule } from './modules/admin/users/admin-users.module'
import { AdminOrganizationsModule } from './modules/admin/orgs/admin-organizations.module'
import { SignaturesModule } from './modules/signatures/signatures.module'
import { RequisitionsController } from './controllers/requisitions.controller'
import { RequisitionsService } from './services/requisitions.service'
import { OnboardingPhysicianController, VerifyController, AdminOnboardingController } from './controllers/onboarding.controller'
import { OnboardingService } from './services/onboarding.service'
import { ConnectController } from './controllers/connect.controller'
import { ConnectService } from './services/connect.service'
import { ProvidersController } from './controllers/providers.controller'
import { IntakeLinksController } from './controllers/intake-links.controller'
import { IntakeLinksService } from './services/intake-links.service'
import { IntakeController } from './controllers/intake.controller'
import { IntakeService } from './services/intake.service'
import { SearchController, PatientsController } from './controllers/search.controller'
import { SearchService } from './services/search.service'
import { LabOrdersController } from './controllers/lab-orders.controller'
import { LabOrdersService } from './services/lab-orders.service'
import { EventsController } from './controllers/events.controller'
import { EventsService } from './services/events.service'
import { MarketerController } from './controllers/marketer.controller'
import { MarketerService } from './services/marketer.service'
import { DuplicateCheckController } from './controllers/duplicate-check.controller'
import { DuplicateCheckService } from './services/duplicate-check.service'
import { CorsConfigService } from './config/cors.config'
import { RateLimitConfigService } from './config/rate-limit.config'

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
    // SignaturesModule, // Temporarily disabled for demo
  ],
  controllers: [
    HealthController, 
    AuthController, 
    MeController,
    ConsultsController, 
    RxController, 
    NotificationsController,
    BusinessMetricsController,
    ComplianceController,
    RequisitionsController,
    OnboardingPhysicianController,
    VerifyController,
    AdminOnboardingController,
    ConnectController,
    ProvidersController,
    IntakeLinksController,
    IntakeController,
    SearchController,
    PatientsController,
    LabOrdersController,
    EventsController,
    MarketerController,
    DuplicateCheckController
  ],
  providers: [
    PrismaService,
    CognitoService,
    ConsultsService,
    ShipmentsService,
    RxService,
    NotificationsService,
    BusinessMetricsService,
    SecurityAuditService,
    HIPAAComplianceService,
    SOC2ComplianceService,
    AuditService,
    AuthService,
    RequisitionsService,
    OnboardingService,
    ConnectService,
    IntakeLinksService,
    IntakeService,
    SearchService,
    LabOrdersService,
    EventsService,
    MarketerService,
    DuplicateCheckService,
    CorsConfigService,
    RateLimitConfigService,
    JwtMiddleware,
    RbacMiddleware,
    TenantMiddleware,
    RateLimitMiddleware,
    ClaimsMiddleware,
    // {
    //   provide: APP_GUARD,
    //   useClass: AbacGuard,
    // },
  ],
})
export class AppModule {
  // Remove explicit initialize/shutdown; TelemetryService handles lifecycle via OnModuleInit/Destroy

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(JwtMiddleware, RbacMiddleware, TenantMiddleware, RateLimitMiddleware)
      .exclude(
        'health',
        'auth/login',
        'auth/refresh',
        'auth/logout',
        'auth/verify-email',
        'onboarding/physician/step1',
        'onboarding/physician/step2',
        'onboarding/physician/step3',
        'onboarding/physician/step4/sign',
        'connect/identify',
        'connect/call-notes',
        'intake/:linkId',
        'intake/:linkId/form',
        'duplicate-check/medicare'
      )
      .forRoutes('*')
      .apply(ClaimsMiddleware)
      .forRoutes(
        'health',
        'auth/login',
        'auth/refresh',
        'auth/logout',
        'auth/verify-email',
        'onboarding/physician/step1',
        'onboarding/physician/step2',
        'onboarding/physician/step3',
        'onboarding/physician/step4/sign',
        'connect/identify',
        'connect/call-notes',
        'intake/:linkId',
        'intake/:linkId/form',
        'duplicate-check/medicare'
      )
  }
}