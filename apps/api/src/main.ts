import 'reflect-metadata'
import { randomUUID } from 'node:crypto'

import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { ConfigService } from '@nestjs/config'
import { AppModule } from './app.module'
import { GlobalExceptionFilter } from './filters/global-exception.filter'
import { ResponseInterceptor } from './interceptors/response.interceptor'
import { logger, logAuditEvent } from './utils/logger'
import { initializeTelemetry, shutdownTelemetry, getObservabilityHealth } from './utils/telemetry'
import { CorsConfigService } from './config/cors.config'
import { RateLimitConfigService } from './config/rate-limit.config'

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

  // Initialize telemetry
  await initializeTelemetry(app.get(ConfigService))
  console.log('Telemetry initialized');

  // Get configuration services for environment-driven settings
  const configService = app.get(ConfigService)
  const corsConfigService = app.get(CorsConfigService)
  const rateLimitConfigService = app.get(RateLimitConfigService)

  // Log configuration summaries
  const corsSummary = corsConfigService.getConfigurationSummary()
  const rateLimitSummary = rateLimitConfigService.getConfigurationSummary()

  logger.info('CORS Configuration loaded', corsSummary)
  logger.info('Rate Limit Configuration loaded', rateLimitSummary)

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

  // Environment-driven CORS configuration using the new service
  const corsConfig = corsConfigService.getConfiguration()

  await app.register(cors as any, {
    origin: (origin: string, cb: (err: Error | null, allow?: boolean) => void) => {
      // Use the CORS service for validation
      const isAllowed = corsConfigService.validateOrigin(origin)
      cb(null, isAllowed)
    },
    credentials: corsConfig.credentials,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.headers,
    exposedHeaders: corsConfig.exposedHeaders,
    maxAge: corsConfig.maxAge,
    preflightContinue: corsConfig.preflightContinue,
  } as any)

  // Environment-driven rate limiting using the new service
  const rateLimitConfig = rateLimitConfigService.getConfiguration()

  if (rateLimitConfig.enabled) {
    await app.register(rateLimit as any, {
      max: rateLimitConfig.maxRequests,
      timeWindow: rateLimitConfig.windowMs,
      errorResponseBuilder: (request: any, context: any) => ({
        code: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${Math.round(context.ttl / 1000)} seconds.`,
      }),
      keyGenerator: (req: any) => {
        // Use environment-specific key generation
        const userId = (req as any).claims?.sub
        const orgId = (req as any).claims?.org_id

        if (userId && orgId) {
          return `rate_limit:${orgId}:${userId}`
        }

        return `rate_limit:ip:${req.ip}`
      },
      skipSuccessfulRequests: rateLimitConfig.skipSuccessfulRequests,
      skipFailedRequests: rateLimitConfig.skipFailedRequests,
    } as any)
  }

  // WebSocket health endpoint
  app.get('/ws/health', (req, reply) => {
    const correlationId = req.headers['x-correlation-id'] || req.headers['correlation-id'] || 'unknown'
    const observabilityHealth = getObservabilityHealth()

    reply.send({
      status: 'healthy',
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      websockets: {
        enabled: true,
        cors_enabled: true,
        path: '/socket.io',
        heartbeat_interval: configService.get<number>('WS_HEARTBEAT_INTERVAL', 30000),
        connection_timeout: configService.get<number>('WS_CONNECTION_TIMEOUT', 60000),
      },
      observability: observabilityHealth,
    })
  })

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

    // Log observability health
    const observabilityHealth = getObservabilityHealth()
    logger.info('Observability health check', observabilityHealth)

    // Log server startup with comprehensive information
    logger.info({
      port,
      host,
      environment: process.env.NODE_ENV || 'development',
      service: 'telehealth-api',
      cors_origins_count: corsConfig.origins.length,
      cors_origins_sample: corsConfig.origins.slice(0, 3),
      rate_limiting: rateLimitConfig.enabled ? `${rateLimitConfig.maxRequests}/${rateLimitConfig.windowMs}ms` : 'disabled',
      rate_limit_strategies: rateLimitConfig.strategies.length,
      telemetry_enabled: observabilityHealth.opentelemetry.enabled,
      collector_endpoint: observabilityHealth.opentelemetry.collectorEndpoint,
    }, 'Server started successfully')

    logAuditEvent({
      action: 'SERVER_START',
      entity: 'system',
      entity_id: 'api-server',
      details: {
        port,
        host,
        environment: process.env.NODE_ENV || 'development',
        observability_enabled: observabilityHealth.opentelemetry.enabled,
      }
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
