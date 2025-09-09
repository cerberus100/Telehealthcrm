import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { logger } from '../../utils/logger'

export interface UpsToken {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
}

export interface UpsOAuthConfig {
  clientId: string
  clientSecret: string
  baseUrl: string
  tokenEndpoint: string
}

@Injectable()
export class UpsOAuthService {
  private readonly logger = new Logger(UpsOAuthService.name)
  private readonly secretsClient: SecretsManagerClient
  private readonly config: UpsOAuthConfig
  private tokenCache: UpsToken | null = null
  private tokenCacheExpiry = 0

  constructor(private configService: ConfigService) {
    this.secretsClient = new SecretsManagerClient({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
    })

    this.config = {
      clientId: '',
      clientSecret: '',
      baseUrl: this.configService.get<string>('UPS_BASE_URL', 'https://onlinetools.ups.com'),
      tokenEndpoint: '/security/v1/oauth/token',
    }
  }

  /**
   * Get a valid access token (cached or fresh)
   */
  async getAccessToken(): Promise<string> {
    try {
      // Check if we have a valid cached token
      if (this.tokenCache && Date.now() < this.tokenCacheExpiry) {
        this.logger.debug('Using cached UPS token')
        return this.tokenCache.access_token
      }

      // Get fresh token
      const token = await this.authenticate()
      this.cacheToken(token)
      
      this.logger.log({
        action: 'UPS_TOKEN_OBTAINED',
        expires_in: token.expires_in,
        token_type: token.token_type,
      })

      return token.access_token
    } catch (error) {
      this.logger.error({
        action: 'UPS_TOKEN_FAILED',
        error: (error as Error).message,
      })
      throw new Error('Failed to obtain UPS access token')
    }
  }

  /**
   * Authenticate with UPS using client credentials grant
   */
  private async authenticate(): Promise<UpsToken> {
    try {
      // Get credentials from AWS Secrets Manager
      const credentials = await this.getCredentials()
      
      const tokenUrl = `${this.config.baseUrl}${this.config.tokenEndpoint}`
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`UPS OAuth failed: ${response.status} ${errorText}`)
      }

      const tokenData = await response.json()
      
      return {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type || 'Bearer',
        expires_in: tokenData.expires_in || 3600,
        expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
      }
    } catch (error) {
      this.logger.error({
        action: 'UPS_AUTHENTICATION_FAILED',
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Get UPS credentials from AWS Secrets Manager
   */
  private async getCredentials(): Promise<{ clientId: string; clientSecret: string }> {
    try {
      const clientIdArn = this.configService.get<string>('UPS_CLIENT_ID_ARN')
      const clientSecretArn = this.configService.get<string>('UPS_CLIENT_SECRET_ARN')

      if (!clientIdArn || !clientSecretArn) {
        throw new Error('UPS credentials ARNs not configured')
      }

      const [clientIdCommand, clientSecretCommand] = await Promise.all([
        new GetSecretValueCommand({ SecretId: clientIdArn }),
        new GetSecretValueCommand({ SecretId: clientSecretArn }),
      ])

      const [clientIdResponse, clientSecretResponse] = await Promise.all([
        this.secretsClient.send(clientIdCommand),
        this.secretsClient.send(clientSecretCommand),
      ])

      const clientId = clientIdResponse.SecretString
      const clientSecret = clientSecretResponse.SecretString

      if (!clientId || !clientSecret) {
        throw new Error('Failed to retrieve UPS credentials from Secrets Manager')
      }

      return { clientId, clientSecret }
    } catch (error) {
      this.logger.error({
        action: 'UPS_CREDENTIALS_FAILED',
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Cache the token with expiry
   */
  private cacheToken(token: UpsToken): void {
    this.tokenCache = token
    // Cache for 55 minutes (5 minutes before expiry)
    this.tokenCacheExpiry = Date.now() + (token.expires_in - 300) * 1000
  }

  /**
   * Clear the token cache (for testing or forced refresh)
   */
  clearTokenCache(): void {
    this.tokenCache = null
    this.tokenCacheExpiry = 0
    this.logger.debug('UPS token cache cleared')
  }

  /**
   * Check if token is cached and valid
   */
  isTokenCached(): boolean {
    return this.tokenCache !== null && Date.now() < this.tokenCacheExpiry
  }

  /**
   * Get token cache info for monitoring
   */
  getTokenCacheInfo(): { cached: boolean; expiresAt: number; timeUntilExpiry: number } {
    const cached = this.isTokenCached()
    const expiresAt = this.tokenCacheExpiry
    const timeUntilExpiry = Math.max(0, expiresAt - Date.now())

    return {
      cached,
      expiresAt,
      timeUntilExpiry,
    }
  }
}
