import pino from 'pino'

// PHI fields that should never be logged
const PHI_FIELDS = new Set([
  'ssn',
  'social_security_number',
  'dob',
  'date_of_birth',
  'phone',
  'phone_number',
  'email',
  'address',
  'street',
  'legal_name',
  'first_name',
  'last_name',
  'name',
  'patient_name',
  'member_id',
  'insurance_member_id',
  'script_blob_encrypted',
  'result_blob_encrypted',
  'medical_history',
  'diagnosis',
  'medications',
  'allergies',
])

// Recursively redact PHI fields from objects
function redactPHI(obj: any, depth = 0): any {
  if (depth > 10) return '[Max Depth]' // Prevent infinite recursion
  
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactPHI(item, depth + 1))
  }
  
  const redacted: any = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    
    // Check if this field contains PHI
    const isPHI = PHI_FIELDS.has(lowerKey) || 
                  lowerKey.includes('patient') ||
                  lowerKey.includes('name') ||
                  lowerKey.includes('phone') ||
                  lowerKey.includes('email') ||
                  lowerKey.includes('address') ||
                  lowerKey.includes('ssn') ||
                  lowerKey.includes('dob') ||
                  lowerKey.includes('member') ||
                  lowerKey.includes('script') ||
                  lowerKey.includes('result') ||
                  lowerKey.includes('medical') ||
                  lowerKey.includes('diagnosis')
    
    if (isPHI) {
      redacted[key] = '[REDACTED_PHI]'
    } else if (typeof value === 'object') {
      redacted[key] = redactPHI(value, depth + 1)
    } else {
      redacted[key] = value
    }
  }
  
  return redacted
}

// Create pino logger with PHI redaction
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'res.headers["set-cookie"]',
      // Add common PHI paths
      '*.ssn',
      '*.social_security_number', 
      '*.dob',
      '*.date_of_birth',
      '*.phone',
      '*.phone_number',
      '*.email',
      '*.address',
      '*.legal_name',
      '*.first_name',
      '*.last_name',
      '*.patient_name',
      '*.member_id',
      '*.insurance_member_id',
      '*.script_blob_encrypted',
      '*.result_blob_encrypted',
      '*.medical_history',
      '*.diagnosis',
      '*.medications',
      '*.allergies',
    ],
    censor: '[REDACTED_PHI]'
  },
  formatters: {
    log: (object) => {
      return redactPHI(object)
    }
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: redactPHI(req.headers),
      remoteAddress: req.ip,
      remotePort: req.socket?.remotePort,
      // Redact request body
      body: redactPHI(req.body),
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: redactPHI(res.getHeaders()),
    }),
    err: pino.stdSerializers.err,
  }
})

// Audit logger - separate logger for HIPAA audit trail
const auditLogger = pino({
  level: 'info',
  formatters: {
    level: (label) => ({ level: label }),
    log: (object) => ({
      ...object,
      audit: true,
      timestamp: new Date().toISOString(),
    })
  },
  // Audit logs should be structured and immutable; emit as JSON without transport
})

// Enhanced logging utilities with correlation ID and structured logging
export const logAuditEvent = (event: {
  action: string
  actor_user_id?: string
  actor_org_id?: string
  entity: string
  entity_id: string
  purpose_of_use?: string
  ip_address?: string
  user_agent?: string
  before?: any
  after?: any
  correlation_id?: string
  metadata?: any
}) => {
  const correlationId = event.correlation_id || generateCorrelationId()
  const timestamp = new Date().toISOString()

  auditLogger.info({
    ...event,
    correlation_id: correlationId,
    timestamp,
    audit_event: true,
    // Ensure no PHI in audit logs
    before: event.before ? redactPHI(event.before) : undefined,
    after: event.after ? redactPHI(event.after) : undefined,
    metadata: event.metadata ? redactPHI(event.metadata) : undefined,
  })
}

export const logSecurityEvent = (event: {
  type: 'AUTH_FAILURE' | 'BREAK_GLASS' | 'SUSPICIOUS_ACTIVITY' | 'RATE_LIMIT_EXCEEDED'
  user_id?: string
  org_id?: string
  ip_address: string
  user_agent?: string
  details?: any
  correlation_id?: string
  metadata?: any
}) => {
  const correlationId = event.correlation_id || generateCorrelationId()
  const timestamp = new Date().toISOString()

  logger.warn({
    ...event,
    correlation_id: correlationId,
    timestamp,
    security_event: true,
    details: event.details ? redactPHI(event.details) : undefined,
    metadata: event.metadata ? redactPHI(event.metadata) : undefined,
  })
}

export const logPerformanceMetric = (metric: {
  operation: string
  duration_ms: number
  status: 'success' | 'error'
  correlation_id?: string
  metadata?: any
  user_id?: string
  org_id?: string
  endpoint?: string
  method?: string
}) => {
  const correlationId = metric.correlation_id || generateCorrelationId()
  const timestamp = new Date().toISOString()

  logger.info({
    ...metric,
    correlation_id: correlationId,
    timestamp,
    performance_metric: true,
    metadata: metric.metadata ? redactPHI(metric.metadata) : undefined,
  })
}

export const logBusinessMetric = (metric: {
  name: string
  value: number
  unit?: string
  correlation_id?: string
  metadata?: any
  user_id?: string
  org_id?: string
  entity?: string
  entity_id?: string
}) => {
  const correlationId = metric.correlation_id || generateCorrelationId()
  const timestamp = new Date().toISOString()

  logger.info({
    ...metric,
    correlation_id: correlationId,
    timestamp,
    business_metric: true,
    metadata: metric.metadata ? redactPHI(metric.metadata) : undefined,
  })
}

// Enhanced logging with correlation ID management
export const generateCorrelationId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const getCorrelationId = (req: any): string => {
  return req.headers?.['x-correlation-id'] ||
         req.headers?.['correlation-id'] ||
         req.correlationId ||
         generateCorrelationId()
}

// Structured logging helper with automatic correlation ID
export const logRequest = (req: any, level: 'info' | 'warn' | 'error' = 'info', message: string, data?: any) => {
  const correlationId = getCorrelationId(req)
  const logData = {
    ...data,
    correlation_id: correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    user_agent: req.headers?.['user-agent'],
    timestamp: new Date().toISOString(),
  }

  if (level === 'error') {
    logger.error({ ...logData, message })
  } else if (level === 'warn') {
    logger.warn({ ...logData, message })
  } else {
    logger.info({ ...logData, message })
  }
}

// Request lifecycle logging
export const logRequestStart = (req: any) => {
  const correlationId = getCorrelationId(req)
  // Add correlation ID to request object for downstream use
  req.correlationId = correlationId

  logger.info({
    correlation_id: correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    user_agent: req.headers?.['user-agent'],
    timestamp: new Date().toISOString(),
    request_start: true,
  })
}

export const logRequestEnd = (req: any, statusCode: number, duration: number) => {
  const correlationId = req.correlationId || getCorrelationId(req)

  logger.info({
    correlation_id: correlationId,
    method: req.method,
    url: req.url,
    status_code: statusCode,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    request_end: true,
  })
}

export const logError = (error: Error, req?: any, context?: any) => {
  const correlationId = req ? getCorrelationId(req) : generateCorrelationId()
  const timestamp = new Date().toISOString()

  logger.error({
    correlation_id: correlationId,
    timestamp,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context: context ? redactPHI(context) : undefined,
    req: req ? {
      method: req.method,
      url: req.url,
      ip: req.ip,
      user_agent: req.headers?.['user-agent'],
    } : undefined,
  })
}

export { logger, auditLogger, redactPHI }
export default logger
