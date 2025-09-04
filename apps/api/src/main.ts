import 'reflect-metadata'
// Initialize telemetry before any other imports
import './utils/telemetry'

import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { AppModule } from './app.module'
import { logger, logAuditEvent } from './utils/logger'
import { shutdownTelemetry } from './utils/telemetry'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ 
      logger,
      requestIdLogLabel: 'correlation_id',
      genReqId: () => crypto.randomUUID(),
    }),
    { 
      logger: false, // Use our custom pino logger
      bufferLogs: false,
    }
  )

  await app.register(helmet as any, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  } as any)
  
  await app.register(cors as any, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  } as any)
  
  await app.register(rateLimit as any, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (request: any, context: any) => ({
      code: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${Math.round(context.ttl / 1000)} seconds.`,
    })
  } as any)

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`)
    
    logAuditEvent({
      action: 'SERVER_SHUTDOWN',
      entity: 'system',
      entity_id: 'api-server',
    })

    try {
      await app.close()
      await shutdownTelemetry()
      logger.info('Server shut down successfully')
      process.exit(0)
    } catch (error) {
      logger.error({ error }, 'Error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  app.enableShutdownHooks()

  const port = Number(process.env.PORT ?? 3001)
  const host = '0.0.0.0'

  await app.listen({ port, host })
  
  logger.info({
    port,
    host,
    environment: process.env.NODE_ENV || 'development',
    service: 'telehealth-api',
  }, 'Server started successfully')

  logAuditEvent({
    action: 'SERVER_START',
    entity: 'system',
    entity_id: 'api-server',
  })
}

bootstrap().catch((err) => {
  logger.error({ err }, 'bootstrap failed')
  process.exit(1)
})
