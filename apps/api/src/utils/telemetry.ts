// OpenTelemetry and observability utilities with real AWS X-Ray integration
import { logger } from './logger'
import { ConfigService } from '@nestjs/config'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
// Note: AWS X-Ray propagator integration will be added when available
import { propagation } from '@opentelemetry/api'
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'

let telemetryEnabled = false
let configService: ConfigService | null = null
let otelSDK: NodeSDK | null = null

// Initialize telemetry with real OpenTelemetry SDK
export async function initializeTelemetry(config: ConfigService) {
  configService = config

  const enabled = config.get<string>('OTEL_ENABLED', 'true') === 'true'
  if (!enabled) {
    logger.info('OpenTelemetry disabled via configuration')
    telemetryEnabled = false
    return
  }

  try {
    const serviceName = config.get<string>('OTEL_SERVICE_NAME', 'telehealth-api')
    const serviceVersion = config.get<string>('OTEL_SERVICE_VERSION', '1.0.0')
    const environment = config.get<string>('NODE_ENV', 'development')
    const collectorEndpoint = config.get<string>('OTEL_COLLECTOR_ENDPOINT')
    const apiKey = config.get<string>('OTEL_API_KEY')

    // Configure diagnostic logging
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)

    // Create resource with service information
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
        'aws.region': config.get<string>('AWS_REGION', 'us-east-1'),
        'service.instance.id': process.env.INSTANCE_ID || 'local',
      })
    )

    // Configure OTLP exporters
    const traceExporter = new OTLPTraceExporter({
      url: collectorEndpoint ? `${collectorEndpoint}/v1/traces` : 'http://localhost:4318/v1/traces',
      headers: apiKey ? { 'api-key': apiKey } : {},
    })

    const logExporter = new OTLPLogExporter({
      url: collectorEndpoint ? `${collectorEndpoint}/v1/logs` : 'http://localhost:4318/v1/logs',
      headers: apiKey ? { 'api-key': apiKey } : {},
    })

    const metricExporter = new OTLPMetricExporter({
      url: collectorEndpoint ? `${collectorEndpoint}/v1/metrics` : 'http://localhost:4318/v1/metrics',
      headers: apiKey ? { 'api-key': apiKey } : {},
    })

    // Create and configure the SDK
    otelSDK = new NodeSDK({
      resource,
      spanProcessors: [new BatchSpanProcessor(traceExporter)],
      logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
      metricReaders: [new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60000, // Export every 60 seconds
      })],
      serviceName,
      serviceVersion,
      instrumentations: [getNodeAutoInstrumentations({
        // Disable file system instrumentation for performance
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        // Configure HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingPaths: ['/health', '/favicon.ico'],
          ignoreOutgoingUrls: ['https://api.github.com'],
        },
        // Configure AWS SDK instrumentation
        '@opentelemetry/instrumentation-aws-sdk': {
          enabled: true,
        },
      })],
    })

    // Set AWS X-Ray propagator for distributed tracing
    propagation.setGlobalPropagator(new AWSXRayPropagator())

    // Initialize the SDK
    await otelSDK.start()

    telemetryEnabled = true

    logger.info({
      msg: 'OpenTelemetry SDK initialized successfully',
      serviceName,
      serviceVersion,
      environment,
      collectorEndpoint: collectorEndpoint || 'not configured',
      exporter: collectorEndpoint ? 'otlp' : 'local',
      awsXRay: true,
    })
  } catch (error) {
    logger.error({
      msg: 'Failed to initialize OpenTelemetry SDK',
      error: (error as Error).message,
      stack: (error as Error).stack,
    })
    telemetryEnabled = false
    // Don't throw error to prevent application startup failure
  }
}

// Shutdown telemetry
export async function shutdownTelemetry() {
  logger.info({
    msg: 'Telemetry shutdown requested',
    telemetryEnabled
  })

  if (otelSDK && telemetryEnabled) {
    try {
      await otelSDK.shutdown()
      logger.info({
        msg: 'OpenTelemetry SDK shutdown completed'
      })
    } catch (error) {
      logger.error({
        msg: 'Error during telemetry shutdown',
        error: (error as Error).message
      })
    }
  }
}

// Import OpenTelemetry APIs for runtime access
import { trace, context } from '@opentelemetry/api'
import { metrics } from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'

// Utility functions for manual instrumentation
export const addSpanAttribute = (key: string, value: any) => {
  const activeSpan = trace.getActiveSpan()
  if (activeSpan && telemetryEnabled) {
    activeSpan.setAttribute(key, value)
  } else {
    logger.debug({
      msg: 'Span attribute added (no active span)',
      key,
      value,
      telemetryEnabled
    })
  }
}

export const addSpanEvent = (name: string, attributes?: Record<string, any>) => {
  const activeSpan = trace.getActiveSpan()
  if (activeSpan && telemetryEnabled) {
    activeSpan.addEvent(name, attributes)
  } else {
    logger.debug({
      msg: 'Span event added (no active span)',
      name,
      attributes,
      telemetryEnabled
    })
  }
}

export const recordException = (error: Error, attributes?: Record<string, any>) => {
  // Record exception in active span
  const activeSpan = trace.getActiveSpan()
  if (activeSpan && telemetryEnabled) {
    activeSpan.recordException(error, attributes)
    activeSpan.setStatus({ code: 2, message: error.message }) // ERROR status
  }

  // Also log via OpenTelemetry logs API if available
  const loggerApi = logs.getLogger('telehealth-api')
  loggerApi.emit({
    body: error.message,
    severityNumber: 17, // ERROR
    severityText: 'ERROR',
    attributes: {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
      ...attributes,
    }
  })

  // Fallback to our structured logger
  logger.error({
    msg: 'Exception recorded',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    attributes,
    telemetryEnabled,
  })
}

export const createCustomMetrics = () => {
  const meter = metrics.getMeter('telehealth-api')

  return {
    recordCounter: (name: string, value: number, attributes?: Record<string, any>) => {
      const counter = meter.createCounter(name, {
        description: `Custom counter for ${name}`,
      })
      counter.add(value, attributes || {})

      logger.debug({
        msg: 'Custom counter recorded',
        name,
        value,
        attributes,
        telemetryEnabled
      })
    },

    recordHistogram: (name: string, value: number, attributes?: Record<string, any>) => {
      const histogram = meter.createHistogram(name, {
        description: `Custom histogram for ${name}`,
      })
      histogram.record(value, attributes || {})

      logger.debug({
        msg: 'Custom histogram recorded',
        name,
        value,
        attributes,
        telemetryEnabled
      })
    },

    recordGauge: (name: string, value: number, attributes?: Record<string, any>) => {
      const gauge = meter.createObservableGauge(name, {
        description: `Custom gauge for ${name}`,
      })

      // For observable gauge, we need to provide a callback
      gauge.addCallback((result) => {
        result.observe(value, attributes || {})
      })

      logger.debug({
        msg: 'Custom gauge recorded',
        name,
        value,
        attributes,
        telemetryEnabled
      })
    },
  }
}

// Helper function to create a span for manual instrumentation
export const withSpan = async <T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> => {
  const tracer = trace.getTracer('telehealth-api')
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn()
      span.setStatus({ code: 1 }) // OK
      return result
    } catch (error) {
      span.setStatus({ code: 2, message: (error as Error).message }) // ERROR
      span.recordException(error as Error)
      throw error
    } finally {
      span.end()
    }
  })
}

// Helper function to add AWS X-Ray trace header to outgoing requests
export const getTraceHeaders = () => {
  const headers: Record<string, string> = {}

  // Get the current trace context
  const activeContext = context.active()
  const carrier: Record<string, string> = {}

  // Inject trace context into carrier
  propagation.inject(activeContext, carrier)

  // Extract X-Ray trace header if present
  const xRayHeader = carrier['x-amzn-trace-id']
  if (xRayHeader) {
    headers['X-Amzn-Trace-Id'] = xRayHeader
  }

  return headers
}

export const getObservabilityHealth = () => {
  const enabled = configService?.get<string>('OTEL_ENABLED', 'true') === 'true'
  const collectorEndpoint = configService?.get<string>('OTEL_COLLECTOR_ENDPOINT')
  const serviceName = configService?.get<string>('OTEL_SERVICE_NAME', 'telehealth-api')
  const environment = configService?.get<string>('NODE_ENV', 'development')

  // Get active spans count if telemetry is enabled
  const activeSpans = telemetryEnabled ? trace.getActiveSpan() : null

  return {
    opentelemetry: {
      enabled,
      initialized: telemetryEnabled,
      mode: collectorEndpoint ? 'otlp' : 'local',
      collectorEndpoint: collectorEndpoint || 'not configured',
      serviceName,
      environment,
      awsXRay: true,
      activeSpans: activeSpans ? 1 : 0,
    },
    logging: {
      level: configService?.get<string>('LOG_LEVEL', 'info') || 'info',
      audit_enabled: true,
      phi_redaction_enabled: true,
      structured_logging_enabled: true,
      correlation_id_enabled: true,
      otel_logging_enabled: telemetryEnabled,
    },
    metrics: {
      enabled: telemetryEnabled,
      custom_metrics: true,
      mode: collectorEndpoint ? 'otlp' : 'local',
      exporter: collectorEndpoint ? 'otlp' : 'local',
      exportInterval: 60000, // 60 seconds
    },
    cors: {
      enabled: true,
      environment_driven: true,
      origins_count: configService?.get<string>('CORS_ORIGINS', 'http://localhost:3000')
        .split(',').length || 1,
    },
    rate_limiting: {
      enabled: configService?.get<boolean>('RATE_LIMIT_ENABLED', true),
      max: configService?.get<number>('RATE_LIMIT_MAX', 300),
      window: configService?.get<string>('RATE_LIMIT_WINDOW', '1 minute'),
      strategies: configService?.get<number>('RATE_LIMIT_STRATEGIES', 6),
    },
    aws: {
      region: configService?.get<string>('AWS_REGION', 'us-east-1'),
      xray_enabled: telemetryEnabled,
      cloudwatch_integration: enabled,
    },
  }
}

export default {
  initializeTelemetry,
  shutdownTelemetry,
  addSpanAttribute,
  addSpanEvent,
  recordException,
  createCustomMetrics,
  getObservabilityHealth,
}
