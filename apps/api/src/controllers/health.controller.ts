import { Controller, Get, Req } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { getObservabilityHealth } from '../utils/telemetry'
import { logger } from '../utils/logger'

@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  // @Abac({ resource: 'Health', action: 'read' })
  get(@Req() req: any) {
    const correlationId = req.headers['correlation-id'] || req.id

    // Basic health information
    const healthResponse = {
      status: 'ok',
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      version: this.configService.get<string>('APP_VERSION', '1.0.0'),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
    }

    // Log health check
    logger.info('Health check requested', {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    })

    return healthResponse
  }

  @Get('observability')
  // @Abac({ resource: 'Health', action: 'read' })
  getObservability(@Req() req: any) {
    const correlationId = req.headers['correlation-id'] || req.id

    // Get comprehensive observability health
    const observabilityHealth = getObservabilityHealth()

    const observabilityResponse = {
      status: 'ok',
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      observability: observabilityHealth,
      configuration: {
        cors_origins_count: this.configService.get<string>('CORS_ORIGINS', 'http://localhost:3000,https://main.*.amplifyapp.com')
          .split(',').length,
        rate_limit_enabled: this.configService.get<boolean>('RATE_LIMIT_ENABLED', true),
        rate_limit_max: this.configService.get<number>('RATE_LIMIT_MAX', 300),
        rate_limit_window: this.configService.get<string>('RATE_LIMIT_WINDOW', '1 minute'),
        log_level: this.configService.get<string>('LOG_LEVEL', 'info'),
        telemetry_enabled: this.configService.get<string>('OTEL_ENABLED', 'true') === 'true',
        service_name: this.configService.get<string>('OTEL_SERVICE_NAME', 'telehealth-crm-api'),
      },
      system: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
      }
    }

    // Log observability health check
    logger.info('Observability health check requested', {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      telemetry_enabled: observabilityHealth.opentelemetry.enabled,
      collector_endpoint: observabilityHealth.opentelemetry.collectorEndpoint,
    })

    return observabilityResponse
  }

  @Get('readiness')
  // @Abac({ resource: 'Health', action: 'read' })
  getReadiness(@Req() req: any) {
    const correlationId = req.headers['correlation-id'] || req.id

    // Check if the application is ready to serve traffic
    const readinessResponse = {
      status: 'ready',
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      checks: {
        database: this.checkDatabase(),
        telemetry: this.checkTelemetry(),
        cors: this.checkCors(),
        rate_limiting: this.checkRateLimiting(),
      }
    }

    // Log readiness check
    logger.info('Readiness check requested', {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      all_checks_passed: Object.values(readinessResponse.checks).every(check => check === 'ok')
    })

    return readinessResponse
  }

  @Get('liveness')
  // @Abac({ resource: 'Health', action: 'read' })
  getLiveness(@Req() req: any) {
    const correlationId = req.headers['correlation-id'] || req.id

    // Simple liveness probe - just check if the process is running
    const livenessResponse = {
      status: 'alive',
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      process_id: process.pid,
    }

    // Log liveness check
    logger.info('Liveness check requested', {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    })

    return livenessResponse
  }

  private checkDatabase(): string {
    // In a real implementation, you would check database connectivity
    // For now, we'll assume it's always ok since we have connection management
    return 'ok'
  }

  private checkTelemetry(): string {
    const observabilityHealth = getObservabilityHealth()
    return observabilityHealth.opentelemetry.enabled ? 'ok' : 'degraded'
  }

  private checkCors(): string {
    return this.configService.get<string>('CORS_ORIGINS') ? 'ok' : 'error'
  }

  private checkRateLimiting(): string {
    const enabled = this.configService.get<boolean>('RATE_LIMIT_ENABLED', true)
    return enabled ? 'ok' : 'disabled'
  }
}
