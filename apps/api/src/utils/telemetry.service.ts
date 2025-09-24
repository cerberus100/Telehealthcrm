// TelemetryService is now deprecated - telemetry is initialized in main.ts
// This file is kept for backwards compatibility

import { Injectable, Logger } from '@nestjs/common';
import { getObservabilityHealth } from './telemetry'

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor() {
    this.logger.warn('TelemetryService is deprecated. Telemetry is now initialized in main.ts')
  }

  // Mock methods for backwards compatibility
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

  async initialize(): Promise<void> {
    // Telemetry is now initialized in main.ts
    this.logger.log('Telemetry initialization handled in main.ts')
  }

  async shutdown(): Promise<void> {
    // Telemetry shutdown is handled in main.ts
    this.logger.log('Telemetry shutdown handled in main.ts')
  }

  getObservabilityHealth() {
    return getObservabilityHealth()
  }
}