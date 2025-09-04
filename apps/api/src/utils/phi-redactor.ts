import { logger } from './logger'

/**
 * PHI (Protected Health Information) redaction utility
 * Implements HIPAA-compliant data scrubbing for logs and audit trails
 */
export class PhiRedactor {
  // Patterns for PHI detection
  private static readonly PATTERNS = {
    // Email addresses (except business domains)
    EMAIL: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    
    // US Phone numbers (various formats)
    PHONE: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
    
    // SSN patterns (XXX-XX-XXXX)
    SSN: /\b\d{3}-\d{2}-\d{4}\b/g,
    
    // Tracking numbers (carrier-specific patterns)
    UPS_TRACKING: /\b1Z[0-9A-Z]{16}\b/g,
    FEDEX_TRACKING: /\b[0-9]{12}\b/g,
    USPS_TRACKING: /\b[0-9]{20}\b/g,
    
    // Names (when in patient context)
    NAME: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    
    // Addresses (street, city if in patient context)
    ADDRESS: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi,
  }

  // Business domains that are allowed (not considered PHI)
  private static readonly ALLOWED_DOMAINS = [
    'teleplatform.com',
    'example.com',
    'test.com',
    'localhost',
  ]

  // Fields that should never be logged (even if not PHI)
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'password_hash',
    'token',
    'secret',
    'key',
    'ssn',
    'social_security',
    'credit_card',
    'card_number',
    'cvv',
    'pin',
  ]

  /**
   * Redact PHI from a string
   */
  static redactString(input: string, context: string = 'general'): string {
    if (!input || typeof input !== 'string') {
      return input
    }

    let redacted = input

    // Redact emails (except business domains)
    redacted = redacted.replace(this.PATTERNS.EMAIL, (match) => {
      const domain = match.split('@')[1]
      if (domain && this.ALLOWED_DOMAINS.includes(domain)) {
        return match
      }
      return '[REDACTED_EMAIL]'
    })

    // Redact phone numbers
    redacted = redacted.replace(this.PATTERNS.PHONE, '[REDACTED_PHONE]')

    // Redact SSNs
    redacted = redacted.replace(this.PATTERNS.SSN, '[REDACTED_SSN]')

    // Redact tracking numbers
    redacted = redacted.replace(this.PATTERNS.UPS_TRACKING, '[REDACTED_TRACKING]')
    redacted = redacted.replace(this.PATTERNS.FEDEX_TRACKING, '[REDACTED_TRACKING]')
    redacted = redacted.replace(this.PATTERNS.USPS_TRACKING, '[REDACTED_TRACKING]')

    // Redact names in patient context
    if (context === 'patient' || context === 'medical') {
      redacted = redacted.replace(this.PATTERNS.NAME, '[REDACTED_NAME]')
      redacted = redacted.replace(this.PATTERNS.ADDRESS, '[REDACTED_ADDRESS]')
    }

    return redacted
  }

  /**
   * Redact PHI from an object recursively
   */
  static redactObject(obj: any, context: string = 'general'): any {
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item, context))
    }

    const redacted: any = {}

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase()

      // Skip sensitive fields entirely
      if (this.SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        redacted[key] = '[REDACTED_SENSITIVE]'
        continue
      }

      // Redact based on value type
      if (typeof value === 'string') {
        redacted[key] = this.redactString(value, context)
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactObject(value, context)
      } else {
        redacted[key] = value
      }
    }

    return redacted
  }

  /**
   * Redact PHI from request/response bodies
   */
  static redactRequestResponse(data: any, type: 'request' | 'response' = 'request'): any {
    const context = type === 'request' ? 'general' : 'general'
    return this.redactObject(data, context)
  }

  /**
   * Redact PHI from patient data specifically
   */
  static redactPatientData(data: any): any {
    return this.redactObject(data, 'patient')
  }

  /**
   * Redact PHI from medical/clinical data
   */
  static redactMedicalData(data: any): any {
    return this.redactObject(data, 'medical')
  }

  /**
   * Check if a string contains PHI
   */
  static containsPhi(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false
    }

    // Check for any PHI patterns
    const hasEmail = this.PATTERNS.EMAIL.test(input)
    const hasPhone = this.PATTERNS.PHONE.test(input)
    const hasSSN = this.PATTERNS.SSN.test(input)
    const hasTracking = this.PATTERNS.UPS_TRACKING.test(input) ||
                      this.PATTERNS.FEDEX_TRACKING.test(input) ||
                      this.PATTERNS.USPS_TRACKING.test(input)

    return hasEmail || hasPhone || hasSSN || hasTracking
  }

  /**
   * Tokenize PHI for correlation while maintaining privacy
   */
  static tokenizePhi(input: string): { token: string; original: string } | null {
    if (!this.containsPhi(input)) {
      return null
    }

    // Generate a deterministic token based on the PHI
    const token = `PHI_${Buffer.from(input).toString('base64').substring(0, 8)}`
    
    return {
      token,
      original: input,
    }
  }

  /**
   * Create a safe log entry with PHI redaction
   */
  static createSafeLog(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const redactedData = data ? this.redactObject(data) : undefined
    
    logger[level]({
      message,
      data: redactedData,
      phi_redacted: !!data,
    })
  }

  /**
   * Validate that no PHI is being logged
   */
  static validateNoPhi(data: any, context: string = 'general'): boolean {
    const redacted = this.redactObject(data, context)
    const original = JSON.stringify(data)
    const redactedStr = JSON.stringify(redacted)
    
    // If they're different, PHI was found and redacted
    if (original !== redactedStr) {
      logger.warn({
        action: 'PHI_DETECTED_IN_LOG',
        context,
        original_length: original.length,
        redacted_length: redactedStr.length,
      })
      return false
    }
    
    return true
  }
}

/**
 * Pino logger configuration with PHI redaction
 */
export const pinoConfig = {
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.token',
      'req.body.secret',
      'res.body.token',
      'res.body.secret',
      '*.password',
      '*.token',
      '*.secret',
      '*.ssn',
      '*.social_security',
      '*.credit_card',
      '*.card_number',
      '*.cvv',
      '*.pin',
    ],
    remove: true,
  },
  serializers: {
    req: (req: any) => {
      const redactedReq = {
        id: req.id,
        method: req.method,
        url: req.url,
        headers: PhiRedactor.redactObject(req.headers),
        body: PhiRedactor.redactRequestResponse(req.body, 'request'),
      }
      return redactedReq
    },
    res: (res: any) => {
      const redactedRes = {
        statusCode: res.statusCode,
        body: PhiRedactor.redactRequestResponse(res.body, 'response'),
      }
      return redactedRes
    },
  },
}
