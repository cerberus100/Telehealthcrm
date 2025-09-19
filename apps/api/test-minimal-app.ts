import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HealthController } from './src/controllers/health.controller'
import { PrismaService } from './src/prisma.service'
import { MockPrismaService } from './src/mock-prisma.service'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: PrismaService,
      useClass: process.env.API_DEMO_MODE === 'true' ? MockPrismaService : PrismaService,
    },
  ],
})
export class MinimalAppModule {}


