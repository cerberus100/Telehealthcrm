import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { logger, redactPHI } from './logger'

// Initialize OpenTelemetry only if enabled
const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true'
const SERVICE_NAME = process.env.SERVICE_NAME || 'telehealth-api'
const SERVICE_VERSION = process.env.SERVICE_VERSION || '0.1.0'
const ENVIRONMENT = process.env.NODE_ENV || 'development'

let sdk: NodeSDK | null = null

if (OTEL_ENABLED) {
  try {
    sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
        [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable instrumentations that might leak PHI
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // File system operations might contain PHI
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: (span, request) => {
              // Redact sensitive headers and query parameters
              const redactedHeaders = redactPHI(request.getHeaders?.() || {})
              span.setAttributes({
                'http.request.headers': JSON.stringify(redactedHeaders),
              })
            },
            responseHook: (span, response) => {
              // Redact sensitive response headers
              const redactedHeaders = redactPHI(response.getHeaders?.() || {})
              span.setAttributes({
                'http.response.headers': JSON.stringify(redactedHeaders),
              })
            },
          },
          '@opentelemetry/instrumentation-express': {
            enabled: false, // We're using Fastify
          },
          '@opentelemetry/instrumentation-fastify': {
            enabled: true,
            requestHook: (span, info) => {
              // Add correlation ID if available
              const correlationId = info.request.headers['x-correlation-id']
              if (correlationId) {
                span.setAttributes({
                  'telehealth.correlation_id': correlationId,
                })
              }
              
              // Add user context if available (without PHI)
              const userId = info.request.headers['x-user-id']
              const orgId = info.request.headers['x-org-id']
              const role = info.request.headers['x-user-role']
              
              if (userId) span.setAttributes({ 'telehealth.user.id': userId })
              if (orgId) span.setAttributes({ 'telehealth.org.id': orgId })
              if (role) span.setAttributes({ 'telehealth.user.role': role })
            },
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
            enhancedDatabaseReporting: false, // Prevent logging of query parameters that might contain PHI
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
            dbStatementSerializer: (cmdName, cmdArgs) => {
              // Redact Redis commands that might contain PHI
              if (cmdArgs && cmdArgs.length > 0) {
                return `${cmdName} [REDACTED]`
              }
              return cmdName
            },
          },
        }),
      ],
      metricReader: new PeriodicExportingMetricReader({
        exportIntervalMillis: 30000, // Export metrics every 30 seconds
      }),
    })

    sdk.start()
    logger.info('OpenTelemetry initialized successfully')
  } catch (error) {
    logger.error({ error }, 'Failed to initialize OpenTelemetry')
  }
}

// Utility functions for custom telemetry
export const addSpanAttribute = (key: string, value: any) => {
  try {
    const { trace } = require('@opentelemetry/api')
    const span = trace.getActiveSpan()
    if (span) {
      // Ensure we don't accidentally log PHI
      const redactedValue = typeof value === 'object' ? redactPHI(value) : value
      span.setAttributes({ [key]: redactedValue })
    }
  } catch (error) {
    // Silently fail if OpenTelemetry is not available
  }
}

export const addSpanEvent = (name: string, attributes?: Record<string, any>) => {
  try {
    const { trace } = require('@opentelemetry/api')
    const span = trace.getActiveSpan()
    if (span) {
      const redactedAttributes = attributes ? redactPHI(attributes) : undefined
      span.addEvent(name, redactedAttributes)
    }
  } catch (error) {
    // Silently fail if OpenTelemetry is not available
  }
}

export const recordException = (error: Error) => {
  try {
    const { trace } = require('@opentelemetry/api')
    const span = trace.getActiveSpan()
    if (span) {
      span.recordException(error)
      span.setStatus({ code: 2 }) // ERROR status
    }
  } catch (e) {
    // Silently fail if OpenTelemetry is not available
  }
}

// Custom metrics for healthcare-specific monitoring
export const createCustomMetrics = () => {
  if (!OTEL_ENABLED) return null

  try {
    const { metrics } = require('@opentelemetry/api')
    const meter = metrics.getMeter(SERVICE_NAME, SERVICE_VERSION)

    return {
      // Counter for consult outcomes
      consultOutcomes: meter.createCounter('telehealth_consult_outcomes_total', {
        description: 'Total number of consult outcomes by type',
      }),
      
      // Histogram for SLA compliance
      slaCompliance: meter.createHistogram('telehealth_sla_duration_seconds', {
        description: 'Time taken to complete SLA-bound operations',
        unit: 's',
      }),
      
      // Counter for PHI access events
      phiAccess: meter.createCounter('telehealth_phi_access_total', {
        description: 'Total number of PHI access events by purpose',
      }),
      
      // Gauge for active sessions
      activeSessions: meter.createUpDownCounter('telehealth_active_sessions', {
        description: 'Number of active user sessions',
      }),
      
      // Counter for security events
      securityEvents: meter.createCounter('telehealth_security_events_total', {
        description: 'Total number of security events by type',
      }),
    }
  } catch (error) {
    logger.error({ error }, 'Failed to create custom metrics')
    return null
  }
}

// Health check for observability stack
export const getObservabilityHealth = () => {
  return {
    opentelemetry: {
      enabled: OTEL_ENABLED,
      initialized: sdk !== null,
    },
    logging: {
      level: logger.level,
      audit_enabled: true,
    },
    metrics: {
      enabled: OTEL_ENABLED,
      custom_metrics: !!createCustomMetrics(),
    },
  }
}

// Graceful shutdown
export const shutdownTelemetry = async () => {
  if (sdk) {
    try {
      await sdk.shutdown()
      logger.info('OpenTelemetry shut down successfully')
    } catch (error) {
      logger.error({ error }, 'Error shutting down OpenTelemetry')
    }
  }
}

export { sdk }
export default {
  addSpanAttribute,
  addSpanEvent,
  recordException,
  createCustomMetrics,
  getObservabilityHealth,
  shutdownTelemetry,
}
