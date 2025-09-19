import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SimpleHealthController } from './src/controllers/simple-health.controller'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  controllers: [SimpleHealthController],
  providers: [],
})
export class SimpleAppModule {}
