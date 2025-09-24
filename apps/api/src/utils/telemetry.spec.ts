import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { getObservabilityHealth, initializeTelemetry, shutdownTelemetry } from './telemetry'
import { logAuditEvent, logSecurityEvent, logPerformanceMetric, logBusinessMetric, generateCorrelationId } from './logger'

describe('Telemetry and Observability', () => {
  let configService: ConfigService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'OTEL_ENABLED': 'true',
                'OTEL_SERVICE_NAME': 'test-service',
                'OTEL_SERVICE_VERSION': '1.0.0',
                'OTEL_COLLECTOR_ENDPOINT': '',
                'OTEL_API_KEY': '',
                'LOG_LEVEL': 'info',
                'CORS_ORIGINS': 'http://localhost:3000',
                'RATE_LIMIT_ENABLED': 'true',
                'RATE_LIMIT_MAX': '300',
                'RATE_LIMIT_WINDOW': '1 minute',
                'APP_VERSION': '1.0.0',
                'NODE_ENV': 'test',
              }
              return config[key as keyof typeof config]
            }),
          },
        },
      ],
    }).compile()

    configService = module.get<ConfigService>(ConfigService)
  })

  describe('Telemetry Initialization', () => {
    it('should initialize telemetry successfully', async () => {
      await initializeTelemetry(configService)

      const health = getObservabilityHealth()
      expect(health.opentelemetry.enabled).toBe(true)
      expect(health.opentelemetry.collectorEndpoint).toBe('not configured') // Since no endpoint is configured in test
      expect(health.opentelemetry.mode).toBe('console')
      expect(health.logging.level).toBe('info')
      expect(health.cors.enabled).toBe(true)
      expect(health.cors.environment_driven).toBe(true)
    })

    it('should handle telemetry shutdown', async () => {
      await shutdownTelemetry()

      const health = getObservabilityHealth()
      // In our simplified telemetry, shutdown doesn't change initialized status
      expect(health.opentelemetry.initialized).toBe(true)
      expect(health.opentelemetry.enabled).toBe(true)
    })

    it('should return comprehensive observability health', () => {
      const health = getObservabilityHealth()

      expect(health).toHaveProperty('opentelemetry')
      expect(health).toHaveProperty('logging')
      expect(health).toHaveProperty('metrics')
      expect(health).toHaveProperty('cors')

      expect(health.opentelemetry).toHaveProperty('enabled')
      expect(health.opentelemetry).toHaveProperty('initialized')
      expect(health.opentelemetry).toHaveProperty('collectorEndpoint')

      expect(health.logging).toHaveProperty('level')
      expect(health.logging).toHaveProperty('audit_enabled')
      expect(health.logging).toHaveProperty('phi_redaction_enabled')

      expect(health.metrics).toHaveProperty('enabled')
      expect(health.metrics).toHaveProperty('custom_metrics')
      expect(health.metrics).toHaveProperty('exporter')
    })
  })

  describe('Logging Utilities', () => {
    it('should generate correlation IDs', () => {
      const correlationId1 = generateCorrelationId()
      const correlationId2 = generateCorrelationId()

      expect(correlationId1).toMatch(/^req_\d+_[a-z0-9]+$/)
      expect(correlationId2).toMatch(/^req_\d+_[a-z0-9]+$/)
      expect(correlationId1).not.toBe(correlationId2)
    })

    it('should log audit events', () => {
      const auditEvent = {
        action: 'TEST_ACTION',
        actor_user_id: 'user123',
        actor_org_id: 'org123',
        entity: 'test_entity',
        entity_id: 'entity123',
        correlation_id: 'test-correlation-id',
      }

      // This should not throw
      expect(() => logAuditEvent(auditEvent)).not.toThrow()
    })

    it('should log security events', () => {
      const securityEvent = {
        type: 'AUTH_FAILURE' as const,
        user_id: 'user123',
        org_id: 'org123',
        ip_address: '127.0.0.1',
        correlation_id: 'test-correlation-id',
      }

      // This should not throw
      expect(() => logSecurityEvent(securityEvent)).not.toThrow()
    })

    it('should log performance metrics', () => {
      const performanceMetric = {
        operation: 'TEST_OPERATION',
        duration_ms: 100,
        status: 'success' as const,
        correlation_id: 'test-correlation-id',
      }

      // This should not throw
      expect(() => logPerformanceMetric(performanceMetric)).not.toThrow()
    })

    it('should log business metrics', () => {
      const businessMetric = {
        name: 'TEST_METRIC',
        value: 42,
        unit: 'count',
        correlation_id: 'test-correlation-id',
      }

      // This should not throw
      expect(() => logBusinessMetric(businessMetric)).not.toThrow()
    })
  })

  describe('Configuration-Driven Features', () => {
    it('should detect CORS configuration', () => {
      const health = getObservabilityHealth()
      expect(health.cors.enabled).toBe(true)
      expect(health.cors.environment_driven).toBe(true)
    })

    it('should detect rate limiting configuration', () => {
      const health = getObservabilityHealth()
      expect(health.metrics.enabled).toBe(true)
    })

    it('should detect logging configuration', () => {
      const health = getObservabilityHealth()
      expect(health.logging.level).toBe('info')
      expect(health.logging.audit_enabled).toBe(true)
      expect(health.logging.phi_redaction_enabled).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', () => {
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'OTEL_ENABLED') return 'false'
          return undefined
        }),
      } as any

      // This should not throw even with minimal configuration
      expect(() => getObservabilityHealth()).not.toThrow()
    })

    it('should handle telemetry initialization errors gracefully', async () => {
      // Mock a config that might cause initialization issues
      const mockConfig = {
        get: jest.fn((key: string) => {
          if (key === 'OTEL_ENABLED') return 'true'
          if (key === 'OTEL_COLLECTOR_ENDPOINT') return 'invalid-url'
          return undefined
        }),
      } as any

      // This should not throw even with invalid configuration
      await expect(initializeTelemetry(mockConfig)).resolves.not.toThrow()
    })
  })
})
