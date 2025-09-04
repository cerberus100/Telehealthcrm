// TODO: Fix telemetry configuration for production
// Temporarily disabled due to TypeScript compilation issues

import { logger } from './logger'

// Disable telemetry for now
export function shutdownTelemetry() {
  console.log('Telemetry shutdown disabled')
}

export const addSpanAttribute = (key: string, value: any) => {
  // No-op for now
}

export const addSpanEvent = (name: string, attributes?: Record<string, any>) => {
  // No-op for now
}

export const recordException = (error: Error) => {
  // No-op for now
}

export const createCustomMetrics = () => {
  return null
}

export const getObservabilityHealth = () => {
  return {
    opentelemetry: {
      enabled: false,
      initialized: false,
    },
    logging: {
      level: 'info',
      audit_enabled: true,
    },
    metrics: {
      enabled: false,
      custom_metrics: false,
    },
  }
}

export default {
  addSpanAttribute,
  addSpanEvent,
  recordException,
  createCustomMetrics,
  getObservabilityHealth,
  shutdownTelemetry,
}
