import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export interface RateLimitConfiguration {
  enabled: boolean
  maxRequests: number
  windowMs: number
  skipSuccessfulRequests: boolean
  skipFailedRequests: boolean
  keyGenerator: 'ip' | 'user' | 'org' | 'custom'
  strategies: RateLimitStrategy[]
}

export interface RateLimitStrategy {
  name: string
  maxRequests: number
  windowMs: number
  appliesTo: (req: any) => boolean
  keyGenerator?: (req: any) => string
}

@Injectable()
export class RateLimitConfigService {
  private readonly defaultMaxRequests = 300
  private readonly defaultWindowMs = 60000 // 1 minute

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get rate limit configuration based on environment
   */
  getConfiguration(): RateLimitConfiguration {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development')
    const deploymentEnv = this.configService.get<string>('DEPLOYMENT_ENV', 'development')
    const enableRateLimit = this.configService.get<boolean>('RATE_LIMIT_ENABLED', true)

    // Build strategies based on environment
    const strategies = this.buildStrategies(nodeEnv, deploymentEnv)

    return {
      enabled: enableRateLimit,
      maxRequests: this.configService.get<number>('RATE_LIMIT_MAX', this.defaultMaxRequests),
      windowMs: this.configService.get<number>('RATE_LIMIT_WINDOW_MS', this.defaultWindowMs),
      skipSuccessfulRequests: this.configService.get<boolean>('RATE_LIMIT_SKIP_SUCCESS', false),
      skipFailedRequests: this.configService.get<boolean>('RATE_LIMIT_SKIP_FAILED', false),
      keyGenerator: this.configService.get<'ip' | 'user' | 'org' | 'custom'>('RATE_LIMIT_KEY_GENERATOR', 'user'),
      strategies
    }
  }

  /**
   * Build rate limiting strategies based on environment
   */
  private buildStrategies(nodeEnv: string, deploymentEnv: string): RateLimitStrategy[] {
    const strategies: RateLimitStrategy[] = []

    // Base strategy for all requests
    strategies.push({
      name: 'base',
      maxRequests: this.getMaxRequestsForEnv(deploymentEnv),
      windowMs: this.getWindowMsForEnv(deploymentEnv),
      appliesTo: () => true, // Applies to all requests
      keyGenerator: this.getKeyGenerator(deploymentEnv)
    })

    // Environment-specific strategies
    switch (deploymentEnv.toLowerCase()) {
      case 'production':
        strategies.push(...this.getProductionStrategies())
        break
      case 'staging':
        strategies.push(...this.getStagingStrategies())
        break
      case 'development':
        strategies.push(...this.getDevelopmentStrategies())
        break
    }

    // Add strategies for different endpoint types
    strategies.push(...this.getEndpointSpecificStrategies())

    return strategies
  }

  /**
   * Get max requests per window for different environments
   */
  private getMaxRequestsForEnv(deploymentEnv: string): number {
    const envConfig = {
      development: this.configService.get<number>('RATE_LIMIT_DEV_MAX', 1000),
      staging: this.configService.get<number>('RATE_LIMIT_STAGING_MAX', 600),
      production: this.configService.get<number>('RATE_LIMIT_PROD_MAX', 300)
    }

    return envConfig[deploymentEnv.toLowerCase() as keyof typeof envConfig] || this.defaultMaxRequests
  }

  /**
   * Get window duration for different environments
   */
  private getWindowMsForEnv(deploymentEnv: string): number {
    const envConfig = {
      development: this.configService.get<number>('RATE_LIMIT_DEV_WINDOW', 300000), // 5 minutes
      staging: this.configService.get<number>('RATE_LIMIT_STAGING_WINDOW', 120000), // 2 minutes
      production: this.configService.get<number>('RATE_LIMIT_PROD_WINDOW', 60000) // 1 minute
    }

    return envConfig[deploymentEnv.toLowerCase() as keyof typeof envConfig] || this.defaultWindowMs
  }

  /**
   * Get key generator function for different environments
   */
  private getKeyGenerator(deploymentEnv: string): (req: any) => string {
    const generators = {
      development: (req: any) => this.generateDevelopmentKey(req),
      staging: (req: any) => this.generateStagingKey(req),
      production: (req: any) => this.generateProductionKey(req)
    }

    return generators[deploymentEnv.toLowerCase() as keyof typeof generators] || this.generateProductionKey
  }

  /**
   * Production-specific rate limiting strategies
   */
  private getProductionStrategies(): RateLimitStrategy[] {
    return [
      {
        name: 'auth_endpoints',
        maxRequests: 10,
        windowMs: 60000, // 1 minute
        appliesTo: (req: any) => req.url?.startsWith('/auth/') && req.method === 'POST',
        keyGenerator: (req: any) => `auth:${req.ip}:${req.body?.email || 'unknown'}`
      },
      {
        name: 'sensitive_endpoints',
        maxRequests: 50,
        windowMs: 60000,
        appliesTo: (req: any) =>
          req.url?.includes('/patients') ||
          req.url?.includes('/rx') ||
          req.url?.includes('/consults'),
        keyGenerator: (req: any) => {
          const userId = req.claims?.sub
          const orgId = req.claims?.org_id
          return userId && orgId ? `sensitive:${orgId}:${userId}` : `sensitive:ip:${req.ip}`
        }
      },
      {
        name: 'file_uploads',
        maxRequests: 20,
        windowMs: 300000, // 5 minutes
        appliesTo: (req: any) => req.url?.includes('/upload') || req.headers['content-type']?.includes('multipart'),
        keyGenerator: (req: any) => {
          const userId = req.claims?.sub
          return userId ? `upload:${userId}` : `upload:ip:${req.ip}`
        }
      },
      {
        name: 'api_keys',
        maxRequests: 1000,
        windowMs: 60000,
        appliesTo: (req: any) => req.headers['x-api-key'] || req.headers['authorization']?.startsWith('Bearer'),
        keyGenerator: (req: any) => {
          const apiKey = req.headers['x-api-key']
          const token = req.headers['authorization']?.replace('Bearer ', '')
          return apiKey ? `apikey:${apiKey.substring(0, 8)}` : `bearer:${token?.substring(0, 8) || req.ip}`
        }
      }
    ]
  }

  /**
   * Staging environment strategies (stricter than dev, more lenient than prod)
   */
  private getStagingStrategies(): RateLimitStrategy[] {
    return [
      {
        name: 'auth_endpoints',
        maxRequests: 20,
        windowMs: 60000,
        appliesTo: (req: any) => req.url?.startsWith('/auth/') && req.method === 'POST',
        keyGenerator: (req: any) => `auth:${req.ip}:${req.body?.email || 'unknown'}`
      },
      {
        name: 'sensitive_endpoints',
        maxRequests: 100,
        windowMs: 60000,
        appliesTo: (req: any) =>
          req.url?.includes('/patients') ||
          req.url?.includes('/rx') ||
          req.url?.includes('/consults')
      },
      {
        name: 'api_keys',
        maxRequests: 1500,
        windowMs: 60000,
        appliesTo: (req: any) => req.headers['x-api-key'] || req.headers['authorization']?.startsWith('Bearer')
      }
    ]
  }

  /**
   * Development environment strategies (most lenient)
   */
  private getDevelopmentStrategies(): RateLimitStrategy[] {
    return [
      {
        name: 'dev_auth',
        maxRequests: 50,
        windowMs: 300000, // 5 minutes
        appliesTo: (req: any) => req.url?.startsWith('/auth/') && req.method === 'POST'
      },
      {
        name: 'dev_all',
        maxRequests: 500,
        windowMs: 300000, // 5 minutes
        appliesTo: () => true
      }
    ]
  }

  /**
   * Endpoint-specific rate limiting strategies
   */
  private getEndpointSpecificStrategies(): RateLimitStrategy[] {
    return [
      {
        name: 'health_check',
        maxRequests: 1000,
        windowMs: 60000,
        appliesTo: (req: any) => req.url === '/health' || req.url === '/ws/health',
        keyGenerator: (req: any) => `health:${req.ip}`
      },
      {
        name: 'static_assets',
        maxRequests: 2000,
        windowMs: 60000,
        appliesTo: (req: any) =>
          req.url?.endsWith('.js') ||
          req.url?.endsWith('.css') ||
          req.url?.endsWith('.png') ||
          req.url?.endsWith('.jpg') ||
          req.url?.endsWith('.ico'),
        keyGenerator: (req: any) => `static:${req.ip}`
      },
      {
        name: 'bulk_operations',
        maxRequests: 10,
        windowMs: 60000,
        appliesTo: (req: any) =>
          req.url?.includes('/bulk') ||
          req.method === 'DELETE' ||
          (req.method === 'POST' && req.url?.includes('/import')),
        keyGenerator: (req: any) => {
          const userId = req.claims?.sub
          return userId ? `bulk:${userId}` : `bulk:ip:${req.ip}`
        }
      }
    ]
  }

  /**
   * Development key generator (more lenient)
   */
  private generateDevelopmentKey(req: any): string {
    const userId = req.claims?.sub
    const orgId = req.claims?.org_id

    if (userId && orgId) {
      return `dev:user:${orgId}:${userId}`
    }

    // Group by IP for development
    return `dev:ip:${req.ip}`
  }

  /**
   * Staging key generator (balanced approach)
   */
  private generateStagingKey(req: any): string {
    const userId = req.claims?.sub
    const orgId = req.claims?.org_id

    if (userId && orgId) {
      return `staging:user:${orgId}:${userId}`
    }

    return `staging:ip:${req.ip}`
  }

  /**
   * Production key generator (most strict)
   */
  private generateProductionKey(req: any): string {
    const userId = req.claims?.sub
    const orgId = req.claims?.org_id

    if (userId && orgId) {
      return `prod:user:${orgId}:${userId}`
    }

    // For unauthenticated requests, use IP but with shorter window
    return `prod:ip:${req.ip}`
  }

  /**
   * Get configuration summary for logging
   */
  getConfigurationSummary(): Record<string, any> {
    const config = this.getConfiguration()
    return {
      rate_limit_enabled: config.enabled,
      rate_limit_max: config.maxRequests,
      rate_limit_window_ms: config.windowMs,
      rate_limit_strategies_count: config.strategies.length,
      rate_limit_strategies: config.strategies.map(s => s.name),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      deployment_env: this.configService.get<string>('DEPLOYMENT_ENV', 'development'),
      key_generator: config.keyGenerator
    }
  }

  /**
   * Validate if a request should be rate limited based on current strategy
   */
  shouldRateLimit(req: any): boolean {
    const config = this.getConfiguration()
    if (!config.enabled) return false

    // Check if request matches any strategy
    return config.strategies.some(strategy => strategy.appliesTo(req))
  }

  /**
   * Get applicable strategies for a request
   */
  getApplicableStrategies(req: any): RateLimitStrategy[] {
    const config = this.getConfiguration()
    return config.strategies.filter(strategy => strategy.appliesTo(req))
  }
}
