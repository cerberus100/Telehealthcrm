import { Module, MiddlewareConsumer } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { AbacGuard } from './abac/abac.guard'
import { ClaimsMiddleware } from './middleware/claims.middleware'
import { HealthController } from './controllers/health.controller'
import { PrismaService } from './prisma.service'
import { DbController } from './controllers/db.controller'

@Module({
  controllers: [HealthController, DbController],
  providers: [
    PrismaService,
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
