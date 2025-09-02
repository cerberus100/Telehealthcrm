import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import pino from 'pino'
import { AppModule } from './app.module'

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: ['req.headers.authorization', 'password', 'token', 'script_blob_encrypted', 'result_blob_encrypted'],
    remove: true,
  },
})

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger }),
  )

  await app.register(helmet as any, { contentSecurityPolicy: false } as any)
  await app.register(cors as any, { origin: true, credentials: true } as any)
  await app.register(rateLimit as any, { max: 300, timeWindow: '1 minute' } as any)

  app.enableShutdownHooks()

  await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
}

bootstrap().catch((err) => {
  logger.error({ err }, 'bootstrap failed')
  process.exit(1)
})
