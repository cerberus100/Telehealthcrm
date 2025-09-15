import 'reflect-metadata'
// Initialize telemetry before any other imports
import './utils/telemetry'
import { randomUUID } from 'node:crypto'

import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './filters/global-exception.filter'
import { ResponseInterceptor } from './interceptors/response.interceptor'
import { logger, logAuditEvent } from './utils/logger'
import { shutdownTelemetry } from './utils/telemetry'

console.log('Starting bootstrap...');

async function bootstrap() {
  try {
    console.log('Creating NestJS application...');
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      {
        logger: ['error', 'warn', 'log', 'debug'],
        bufferLogs: false,
      }
    )
    console.log('NestJS application created successfully');

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
    origin: [
      'https://main.*.amplifyapp.com',
      'http://localhost:3000'
    ], 
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'Correlation-Id'],
    exposedHeaders: ['Correlation-Id', 'X-RateLimit-Remaining', 'Retry-After']
  } as any)
  
  await app.register(rateLimit as any, {
    max: 300,
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

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter())
  
  // Global response interceptor
  app.useGlobalInterceptors(new ResponseInterceptor())

  app.enableShutdownHooks()

  const port = Number(process.env.PORT ?? 3001)
  const host = '0.0.0.0'

    console.log(`Starting server on ${host}:${port}...`);
    await app.listen({ port, host })
    
    console.log('Server started successfully!');
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
  } catch (error) {
    console.error('Bootstrap failed:', error);
    throw error;
  }
}

bootstrap().catch((err) => {
  logger.error({ err }, 'bootstrap failed')
  process.exit(1)
})

// Surface any silent failures
process.on('uncaughtException', (error) => {
  console.error('uncaughtException:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason)
})
