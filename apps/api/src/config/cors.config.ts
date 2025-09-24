import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface CorsConfiguration {
  origins: string[]
  credentials: boolean
  methods: string[]
  headers: string[]
  exposedHeaders: string[]
  maxAge: number
  preflightContinue: boolean
}

@Injectable()
export class CorsConfigService {
  private readonly defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://localhost:3001'
  ]

  private readonly defaultMethods = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ]

  private readonly defaultHeaders = [
    'Authorization',
    'Content-Type',
    'Idempotency-Key',
    'X-Correlation-Id',
    'X-Requested-With',
    'Accept',
    'Origin'
  ]

  private readonly defaultExposedHeaders = [
    'X-Correlation-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'Retry-After'
  ]

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get CORS configuration based on environment
   * Supports multiple configuration patterns for different deployment scenarios
   */
  getConfiguration(): CorsConfiguration {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development')
    const deploymentEnv = this.configService.get<string>('DEPLOYMENT_ENV', 'development')
    const customDomains = this.configService.get<string>('CUSTOM_DOMAINS', '')
    const amplifyAppId = this.configService.get<string>('AMPLIFY_APP_ID', '')
    const amplifyBranch = this.configService.get<string>('AWS_BRANCH', 'main')

    // Build origins list based on environment
    const origins = this.buildOriginsList(
      nodeEnv,
      deploymentEnv,
      customDomains,
      amplifyAppId,
      amplifyBranch
    )

    return {
      origins,
      credentials: this.configService.get<boolean>('CORS_CREDENTIALS', true),
      methods: this.configService.get<string>('CORS_METHODS', this.defaultMethods.join(','))?.split(',') || this.defaultMethods,
      headers: this.configService.get<string>('CORS_HEADERS', this.defaultHeaders.join(','))?.split(',') || this.defaultHeaders,
      exposedHeaders: this.configService.get<string>('CORS_EXPOSED_HEADERS', this.defaultExposedHeaders.join(','))?.split(',') || this.defaultExposedHeaders,
      maxAge: this.configService.get<number>('CORS_MAX_AGE', 86400),
      preflightContinue: false
    }
  }

  /**
   * Build origins list based on deployment environment
   */
  private buildOriginsList(
    nodeEnv: string,
    deploymentEnv: string,
    customDomains: string,
    amplifyAppId: string,
    amplifyBranch: string
  ): string[] {
    const origins = new Set<string>()

    // Always include default development origins
    this.defaultOrigins.forEach(origin => origins.add(origin))

    // Add environment-specific origins
    switch (deploymentEnv.toLowerCase()) {
      case 'production':
        this.addProductionOrigins(origins, customDomains, amplifyAppId)
        break
      case 'staging':
        this.addStagingOrigins(origins, customDomains, amplifyAppId, amplifyBranch)
        break
      case 'development':
        this.addDevelopmentOrigins(origins, customDomains, amplifyAppId, amplifyBranch)
        break
      default:
        // Custom environment - use custom domains if provided
        if (customDomains) {
          customDomains.split(',').forEach(domain => {
            const trimmed = domain.trim()
            if (trimmed) {
              origins.add(trimmed)
              // Add with protocol variations
              if (!trimmed.startsWith('http')) {
                origins.add(`https://${trimmed}`)
                origins.add(`http://${trimmed}`)
              }
            }
          })
        }
    }

    // Add wildcard patterns for Amplify deployments
    if (amplifyAppId && amplifyBranch) {
      this.addAmplifyOrigins(origins, amplifyAppId, amplifyBranch)
    }

    return Array.from(origins)
  }

  /**
   * Add production-specific CORS origins
   */
  private addProductionOrigins(origins: Set<string>, customDomains: string, amplifyAppId: string): void {
    // Add custom domains if provided
    if (customDomains) {
      customDomains.split(',').forEach(domain => {
        const trimmed = domain.trim()
        if (trimmed) {
          origins.add(`https://${trimmed}`)
        }
      })
    }

    // Add Amplify production URL pattern
    if (amplifyAppId) {
      origins.add(`https://main.${amplifyAppId}.amplifyapp.com`)
    }

    // Add common production patterns
    origins.add('https://*.vercel.app')
    origins.add('https://*.netlify.app')
    origins.add('https://*.surge.sh')
  }

  /**
   * Add staging/preview environment origins
   */
  private addStagingOrigins(origins: Set<string>, customDomains: string, amplifyAppId: string, amplifyBranch: string): void {
    // Add custom domains
    if (customDomains) {
      customDomains.split(',').forEach(domain => {
        const trimmed = domain.trim()
        if (trimmed) {
          origins.add(`https://${trimmed}`)
        }
      })
    }

    // Add Amplify staging URLs
    if (amplifyAppId) {
      // Feature branch deployments
      if (amplifyBranch && amplifyBranch !== 'main') {
        origins.add(`https://${amplifyBranch}.${amplifyAppId}.amplifyapp.com`)
      }
      // Pull request previews
      origins.add(`https://pr-*.${amplifyAppId}.amplifyapp.com`)
    }

    // Add common staging patterns
    origins.add('https://*-staging.*')
    origins.add('https://*.preview.*')
  }

  /**
   * Add development environment origins
   */
  private addDevelopmentOrigins(origins: Set<string>, customDomains: string, amplifyAppId: string, amplifyBranch: string): void {
    // Add custom domains
    if (customDomains) {
      customDomains.split(',').forEach(domain => {
        const trimmed = domain.trim()
        if (trimmed) {
          origins.add(`https://${trimmed}`)
          origins.add(`http://${trimmed}`)
        }
      })
    }

    // Add Amplify development URLs
    if (amplifyAppId && amplifyBranch) {
      origins.add(`https://${amplifyBranch}.${amplifyAppId}.amplifyapp.com`)
    }

    // Add common development patterns
    origins.add('https://*.localhost')
    origins.add('https://*.ngrok.io')
    origins.add('https://*.ngrok-free.app')
    origins.add('https://*.localtunnel.me')
  }

  /**
   * Add Amplify-specific origin patterns
   */
  private addAmplifyOrigins(origins: Set<string>, amplifyAppId: string, amplifyBranch: string): void {
    // Main branch
    origins.add(`https://main.${amplifyAppId}.amplifyapp.com`)

    // Feature branch
    if (amplifyBranch && amplifyBranch !== 'main') {
      origins.add(`https://${amplifyBranch}.${amplifyAppId}.amplifyapp.com`)
    }

    // Wildcard for any branch
    origins.add(`https://*.${amplifyAppId}.amplifyapp.com`)

    // Pull request previews
    origins.add(`https://pr-*.${amplifyAppId}.amplifyapp.com`)
  }

  /**
   * Validate origin against configuration
   */
  validateOrigin(origin: string | undefined): boolean {
    if (!origin) return true // Allow requests with no origin (mobile apps, etc.)

    const config = this.getConfiguration()
    return config.origins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const pattern = allowedOrigin.replace(/\*/g, '.*')
        return new RegExp(pattern).test(origin)
      }
      return allowedOrigin === origin
    })
  }

  /**
   * Get configuration summary for logging
   */
  getConfigurationSummary(): Record<string, any> {
    const config = this.getConfiguration()
    return {
      cors_origins_count: config.origins.length,
      cors_origins_sample: config.origins.slice(0, 3),
      cors_credentials: config.credentials,
      cors_methods: config.methods,
      cors_max_age: config.maxAge,
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      deployment_env: this.configService.get<string>('DEPLOYMENT_ENV', 'development'),
      amplify_app_id: this.configService.get<string>('AMPLIFY_APP_ID', 'not_set'),
      custom_domains: this.configService.get<string>('CUSTOM_DOMAINS', 'not_set')
    }
  }
}
