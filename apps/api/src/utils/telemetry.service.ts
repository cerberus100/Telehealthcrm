import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryService.name);
  private sdk: NodeSDK | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.sdk) {
      return; // Already initialized
    }

    try {
      const serviceName = this.configService.get<string>('OTEL_SERVICE_NAME', 'telehealth-crm-api');
      const otelCollectorEndpoint = this.configService.get<string>('OTEL_COLLECTOR_ENDPOINT');

      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      });

      const traceExporter = otelCollectorEndpoint
        ? undefined // Use OTLP exporter in production
        : new ConsoleSpanExporter();

      this.sdk = new NodeSDK({
        resource: resource,
        traceExporter: traceExporter,
        instrumentations: [getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-aws-sdk': {
            enabled: true,
          },
        })],
      });

      // Start the SDK
      await this.sdk.start();

      this.logger.log('OpenTelemetry SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenTelemetry SDK:', error);
      // Don't throw error to prevent application startup failure
    }
  }

  async onModuleDestroy() {
    await this.shutdown();
  }

  async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        this.logger.log('OpenTelemetry SDK shut down successfully');
      } catch (error) {
        this.logger.error('Error shutting down OpenTelemetry SDK:', error);
      }
      this.sdk = null;
    }
  }

  // Mock methods for compatibility with existing code
  createSpan(name: string, attributes?: Record<string, any>) {
    return { 
      name, 
      attributes,
      end: () => {}, // Mock end method
    };
  }

  setSpanAttributes(span: any, attributes: Record<string, any>) {
    // No-op for now
  }

  recordHistogram(name: string, value: number, attributes?: Record<string, any>) {
    // No-op for now
  }

  recordMetric(name: string, value: number, attributes?: Record<string, any>) {
    // No-op for now
  }

  addSpanEvent(span: any, name: string, attributes?: Record<string, any>) {
    // No-op for now
  }
}