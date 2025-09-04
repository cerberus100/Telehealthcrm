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
  },
  ...(process.env.NODE_ENV === 'production' && {
    // In production, use JSON format for structured logging
    transport: undefined,
  }),
  ...(process.env.NODE_ENV === 'development' && {
    // In development, use pretty printing
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'hostname,pid',
      }
    }
  })
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
  // Audit logs should be structured and immutable
  transport: process.env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
    options: {
      colorize: false,
      translateTime: 'SYS:iso',
    }
  }
})

// Utility functions for common logging patterns
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
}) => {
  auditLogger.info({
    ...event,
    // Ensure no PHI in audit logs
    before: event.before ? redactPHI(event.before) : undefined,
    after: event.after ? redactPHI(event.after) : undefined,
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
}) => {
  logger.warn({
    security_event: true,
    ...event,
    details: event.details ? redactPHI(event.details) : undefined,
  })
}

export const logPerformanceMetric = (metric: {
  operation: string
  duration_ms: number
  status: 'success' | 'error'
  correlation_id?: string
  metadata?: any
}) => {
  logger.info({
    performance_metric: true,
    ...metric,
    metadata: metric.metadata ? redactPHI(metric.metadata) : undefined,
  })
}

export { logger, auditLogger, redactPHI }
export default logger
