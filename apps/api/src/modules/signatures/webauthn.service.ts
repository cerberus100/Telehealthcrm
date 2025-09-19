import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma.service'
import { logger } from '../../utils/logger'

// WebAuthn credential for user enrollment
interface WebAuthnCredential {
  id: string
  userId: string
  credentialId: string
  publicKey: string
  aaguid: string
  counter: number
  createdAt: Date
}

// Registration options for WebAuthn ceremony
interface RegistrationOptions {
  challenge: string
  rp: {
    name: string
    id: string
  }
  user: {
    id: string
    name: string
    displayName: string
  }
  pubKeyCredParams: Array<{
    type: 'public-key'
    alg: number
  }>
  authenticatorSelection: {
    authenticatorAttachment?: 'platform' | 'cross-platform'
    userVerification: 'required'
    residentKey: 'preferred'
  }
  timeout: number
}

// Authentication options for WebAuthn ceremony
interface AuthenticationOptions {
  challenge: string
  allowCredentials: Array<{
    id: string
    type: 'public-key'
  }>
  userVerification: 'required'
  timeout: number
}

@Injectable()
export class WebAuthnService {
  private readonly rpId: string
  private readonly rpName: string
  private readonly demoMode: boolean

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    this.demoMode = this.config.get<string>('API_DEMO_MODE') === 'true'
    this.rpId = this.config.get<string>('WEBAUTHN_RP_ID') || 'localhost'
    this.rpName = this.config.get<string>('WEBAUTHN_RP_NAME') || 'Teleplatform'
  }

  /**
   * Generate registration options for WebAuthn enrollment
   */
  async generateRegistrationOptions(
    userId: string,
    userEmail: string,
    userName: string
  ): Promise<RegistrationOptions> {
    try {
      const challenge = this.generateChallenge()
      
      // Store challenge temporarily for verification
      await this.storeChallenge(userId, challenge, 'registration')

      const options: RegistrationOptions = {
        challenge,
        rp: {
          name: this.rpName,
          id: this.rpId,
        },
        user: {
          id: userId,
          name: userEmail,
          displayName: userName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },  // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Prefer built-in authenticators
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000, // 60 seconds
      }

      logger.info({
        action: 'WEBAUTHN_REGISTRATION_OPTIONS_GENERATED',
        user_id: userId,
        challenge_length: challenge.length,
      })

      return options
    } catch (error) {
      logger.error({
        action: 'WEBAUTHN_REGISTRATION_OPTIONS_FAILED',
        user_id: userId,
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Verify registration response and store credential
   */
  async verifyRegistration(
    userId: string,
    registrationResponse: any
  ): Promise<{ verified: boolean; credentialId: string }> {
    try {
      if (this.demoMode) {
        // Mock verification for demo
        const credentialId = `demo-credential-${userId}`
        
        // Store mock credential
        await this.storeCredential(userId, {
          credentialId,
          publicKey: 'demo-public-key',
          aaguid: 'demo-aaguid',
          counter: 0,
        })

        return { verified: true, credentialId }
      }

      // TODO: Implement actual WebAuthn registration verification
      // Using @simplewebauthn/server:
      // const verification = await verifyRegistrationResponse({
      //   response: registrationResponse,
      //   expectedChallenge: storedChallenge,
      //   expectedOrigin: this.config.get('WEBAUTHN_ORIGIN'),
      //   expectedRPID: this.rpId,
      // })

      const credentialId = 'placeholder-credential-id'
      
      await this.storeCredential(userId, {
        credentialId,
        publicKey: 'placeholder-public-key',
        aaguid: 'placeholder-aaguid',
        counter: 0,
      })

      return { verified: true, credentialId }
    } catch (error) {
      logger.error({
        action: 'WEBAUTHN_REGISTRATION_VERIFICATION_FAILED',
        user_id: userId,
        error: (error as Error).message,
      })
      throw new BadRequestException('Registration verification failed')
    }
  }

  /**
   * Generate authentication options for signing ceremony
   */
  async generateAuthenticationOptions(userId: string): Promise<AuthenticationOptions> {
    try {
      const challenge = this.generateChallenge()
      
      // Get user's enrolled credentials
      const credentials = await this.getUserCredentials(userId)
      
      if (credentials.length === 0) {
        throw new BadRequestException('No WebAuthn credentials enrolled')
      }

      // Store challenge temporarily for verification
      await this.storeChallenge(userId, challenge, 'authentication')

      const options: AuthenticationOptions = {
        challenge,
        allowCredentials: credentials.map(cred => ({
          id: cred.credentialId,
          type: 'public-key' as const,
        })),
        userVerification: 'required',
        timeout: 60000, // 60 seconds
      }

      logger.info({
        action: 'WEBAUTHN_AUTHENTICATION_OPTIONS_GENERATED',
        user_id: userId,
        credential_count: credentials.length,
      })

      return options
    } catch (error) {
      logger.error({
        action: 'WEBAUTHN_AUTHENTICATION_OPTIONS_FAILED',
        user_id: userId,
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Verify authentication response for signing
   */
  async verifyAuthentication(
    userId: string,
    authenticationResponse: any
  ): Promise<{ verified: boolean; credentialId: string; aaguid: string }> {
    try {
      if (this.demoMode) {
        // Mock verification for demo
        return {
          verified: true,
          credentialId: `demo-credential-${userId}`,
          aaguid: 'demo-aaguid',
        }
      }

      // TODO: Implement actual WebAuthn authentication verification
      // Using @simplewebauthn/server:
      // const verification = await verifyAuthenticationResponse({
      //   response: authenticationResponse,
      //   expectedChallenge: storedChallenge,
      //   expectedOrigin: this.config.get('WEBAUTHN_ORIGIN'),
      //   expectedRPID: this.rpId,
      //   authenticator: storedCredential,
      // })

      return {
        verified: true,
        credentialId: 'placeholder-credential-id',
        aaguid: 'placeholder-aaguid',
      }
    } catch (error) {
      logger.error({
        action: 'WEBAUTHN_AUTHENTICATION_VERIFICATION_FAILED',
        user_id: userId,
        error: (error as Error).message,
      })
      throw new BadRequestException('Authentication verification failed')
    }
  }

  /**
   * Generate cryptographically secure challenge
   */
  private generateChallenge(): string {
    return crypto.randomUUID().replace(/-/g, '')
  }

  /**
   * Store challenge temporarily (Redis or DB)
   */
  private async storeChallenge(
    userId: string,
    challenge: string,
    type: 'registration' | 'authentication'
  ): Promise<void> {
    // TODO: Store in Redis with TTL or temporary DB table
    // For demo, we'll skip storage and accept any challenge
    logger.debug({
      action: 'WEBAUTHN_CHALLENGE_STORED',
      user_id: userId,
      type,
      challenge_length: challenge.length,
    })
  }

  /**
   * Store WebAuthn credential for user
   */
  private async storeCredential(
    userId: string,
    credential: {
      credentialId: string
      publicKey: string
      aaguid: string
      counter: number
    }
  ): Promise<void> {
    // TODO: Add WebAuthnCredential model to Prisma schema
    // For now, log the credential storage
    logger.info({
      action: 'WEBAUTHN_CREDENTIAL_STORED',
      user_id: userId,
      credential_id: credential.credentialId,
      aaguid: credential.aaguid,
    })
  }

  /**
   * Get user's enrolled WebAuthn credentials
   */
  private async getUserCredentials(userId: string): Promise<WebAuthnCredential[]> {
    // TODO: Query from WebAuthnCredential table
    // For demo, return mock credential
    if (this.demoMode) {
      return [{
        id: crypto.randomUUID(),
        userId,
        credentialId: `demo-credential-${userId}`,
        publicKey: 'demo-public-key',
        aaguid: 'demo-aaguid',
        counter: 0,
        createdAt: new Date(),
      }]
    }

    return []
  }
}
