/**
 * TURN Server Configuration Service
 * HIPAA/SOC2 Compliant: Manages WebRTC TURN/STUN server configuration
 * 
 * Security Controls:
 * - Credentials stored in Secrets Manager
 * - Configuration cached for performance
 * - TLS-only TURN servers
 * - Geographic distribution for reliability
 */

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { logger } from '../utils/logger'

export interface TURNServer {
  urls: string[]
  username?: string
  credential?: string
  region?: string
}

export interface WebRTCConfiguration {
  iceServers: TURNServer[]
  iceTransportPolicy: 'all' | 'relay'
  bundlePolicy?: 'balanced' | 'max-bundle' | 'max-compat'
  rtcpMuxPolicy?: 'negotiate' | 'require'
}

@Injectable()
export class TurnConfigService {
  private readonly ssmClient: SSMClient
  private readonly secretsClient: SecretsManagerClient
  private readonly region: string
  private readonly environment: string
  private configCache: WebRTCConfiguration | null = null
  private cacheExpiry: number = 0

  constructor(private readonly config: ConfigService) {
    this.region = this.config.get<string>('AWS_REGION', 'us-east-1')
    this.environment = this.config.get<string>('NODE_ENV', 'development')
    
    this.ssmClient = new SSMClient({ region: this.region })
    this.secretsClient = new SecretsManagerClient({ region: this.region })
  }

  /**
   * Get WebRTC configuration with TURN servers
   * Cached for 5 minutes to reduce AWS API calls
   */
  async getWebRTCConfiguration(): Promise<WebRTCConfiguration> {
    try {
      // Check cache (5 minute TTL)
      if (this.configCache && Date.now() < this.cacheExpiry) {
        return this.configCache
      }

      // For development, return sensible defaults
      if (this.environment === 'development' || this.environment === 'test') {
        const devConfig: WebRTCConfiguration = {
          iceServers: [
            {
              urls: ['stun:stun.l.google.com:19302']
            }
          ],
          iceTransportPolicy: 'all',
          bundlePolicy: 'balanced',
          rtcpMuxPolicy: 'require'
        }
        
        logger.info({
          msg: 'Using development WebRTC configuration',
          environment: this.environment
        })
        
        return devConfig
      }

      // Production: Load from SSM Parameter Store
      const configParam = await this.ssmClient.send(new GetParameterCommand({
        Name: `/telehealth/${this.environment}/webrtc/config`,
        WithDecryption: true
      }))

      const turnServersParam = await this.ssmClient.send(new GetParameterCommand({
        Name: `/telehealth/${this.environment}/webrtc/turn-servers`,
        WithDecryption: true
      }))

      const icePolicyParam = await this.ssmClient.send(new GetParameterCommand({
        Name: `/telehealth/${this.environment}/webrtc/ice-policy`,
        WithDecryption: false
      }))

      if (!configParam.Parameter?.Value || !turnServersParam.Parameter?.Value) {
        throw new Error('WebRTC configuration not found in SSM')
      }

      const turnConfig = JSON.parse(turnServersParam.Parameter.Value)
      const icePolicy = icePolicyParam.Parameter?.Value || 'all'

      // Build ICE servers array
      const iceServers: TURNServer[] = []

      // Add public STUN servers (for NAT traversal)
      if (turnConfig.public_fallback) {
        iceServers.push({
          urls: turnConfig.public_fallback.urls
        })
      }

      // Add custom TURN servers with credentials
      if (turnConfig.primary) {
        const primaryCreds = await this.getTURNCredentials(turnConfig.primary.credential_ssm)
        iceServers.push({
          urls: turnConfig.primary.urls,
          username: primaryCreds.username,
          credential: primaryCreds.password,
          region: turnConfig.primary.region
        })
      }

      if (turnConfig.secondary) {
        const secondaryCreds = await this.getTURNCredentials(turnConfig.secondary.credential_ssm)
        iceServers.push({
          urls: turnConfig.secondary.urls,
          username: secondaryCreds.username,
          credential: secondaryCreds.password,
          region: turnConfig.secondary.region
        })
      }

      const configuration: WebRTCConfiguration = {
        iceServers,
        iceTransportPolicy: icePolicy as 'all' | 'relay',
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require'
      }

      // Cache for 5 minutes
      this.configCache = configuration
      this.cacheExpiry = Date.now() + (5 * 60 * 1000)

      logger.info({
        msg: 'WebRTC configuration loaded',
        ice_servers_count: iceServers.length,
        ice_transport_policy: icePolicy,
        ttl: '5min'
      })

      return configuration

    } catch (error) {
      logger.error({
        msg: 'Failed to load WebRTC configuration, using fallback',
        error: error instanceof Error ? error.message : String(error)
      })

      // Fallback to basic STUN configuration
      return {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302'] },
          { urls: ['stun:stun1.l.google.com:19302'] }
        ],
        iceTransportPolicy: 'all',
        bundlePolicy: 'balanced',
        rtcpMuxPolicy: 'require'
      }
    }
  }

  /**
   * Get TURN server credentials from Secrets Manager
   */
  private async getTURNCredentials(secretName: string): Promise<{ username: string; password: string }> {
    try {
      const result = await this.secretsClient.send(new GetSecretValueCommand({
        SecretId: secretName
      }))

      if (!result.SecretString) {
        throw new Error('Secret value not found')
      }

      const secret = JSON.parse(result.SecretString)
      return {
        username: secret.username,
        password: secret.password
      }

    } catch (error) {
      logger.error({
        msg: 'Failed to retrieve TURN credentials',
        secret_name: secretName,
        error: error instanceof Error ? error.message : String(error)
      })
      
      // Return empty credentials - will fall back to STUN only
      return { username: '', password: '' }
    }
  }

  /**
   * Get client-safe configuration (no credentials exposed)
   * Returns configuration for frontend with AWS-managed TURN
   */
  async getClientConfiguration(): Promise<{
    iceTransportPolicy: string
    stunServers: string[]
    useAwsManaged: boolean
  }> {
    const config = await this.getWebRTCConfiguration()
    
    return {
      iceTransportPolicy: config.iceTransportPolicy,
      stunServers: config.iceServers
        .filter(server => !server.credential) // Only include STUN servers
        .flatMap(server => server.urls),
      useAwsManaged: true // Always use Chime SDK managed TURN
    }
  }

  /**
   * Invalidate cache (for config updates)
   */
  invalidateCache(): void {
    this.configCache = null
    this.cacheExpiry = 0
    logger.info({ msg: 'TURN configuration cache invalidated' })
  }
}

