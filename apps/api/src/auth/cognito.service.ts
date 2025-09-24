import { Injectable, UnauthorizedException, ForbiddenException, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { logger } from '../utils/logger'

export interface CognitoUser {
  sub: string
  email: string
  email_verified: boolean
  org_id: string
  role: string
  purpose_of_use?: string
  groups: string[]
  mfa_enabled: boolean
  last_login_at: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  user: CognitoUser
  accessToken?: string  // Alias for compatibility
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  accessToken?: string  // Alias for compatibility
}

@Injectable()
export class CognitoService {
  private readonly cognitoJwtVerifier: any
  private readonly secretsClient: SecretsManagerClient | null
  private readonly userPoolId: string
  private readonly clientId: string
  private readonly demoMode: boolean

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const userPoolId = this.configService.get<string>('COGNITO_USER_POOL_ID')
    const clientId = this.configService.get<string>('COGNITO_CLIENT_ID')
    const demoMode = this.configService.get<string>('API_DEMO_MODE') === 'true'

    if (demoMode) {
      logger.warn({
        action: 'DEMO_MODE_ENABLED',
        message: 'API_DEMO_MODE is enabled - using mock authentication. This should NOT be used in production.'
      })
    }

    if (!userPoolId || !clientId) {
      const errorMsg = 'COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be configured for production authentication'
      logger.error({ action: 'MISSING_COGNITO_CONFIG', error: errorMsg })
      throw new Error(errorMsg)
    }

    this.userPoolId = userPoolId
    this.clientId = clientId
    this.demoMode = demoMode

    if (!demoMode) {
      // Only initialize real AWS services when not in demo mode
      this.cognitoJwtVerifier = CognitoJwtVerifier.create({
        userPoolId: this.userPoolId,
        tokenUse: 'access',
        clientId: this.clientId,
      })

      this.secretsClient = new SecretsManagerClient({
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      })

      logger.info({
        action: 'COGNITO_SERVICE_INITIALIZED',
        user_pool_id: this.userPoolId,
        client_id: this.clientId.substring(0, 8) + '***', // Log partial client ID for security
        demo_mode: false
      })
    } else {
      logger.warn({
        action: 'COGNITO_DEMO_MODE',
        message: 'Using mock authentication - all security bypassed'
      })
    }
  }

  /**
   * Check if running in demo mode
   */
  isDemoMode(): boolean {
    return this.demoMode
  }

  /**
   * Validate JWT token and extract user claims
   */
  async validateToken(token: string): Promise<CognitoUser> {
    if (this.demoMode) {
      // Demo mode: parse mock token format
      if (token.startsWith('mock_access_')) {
        return this.parseMockToken(token)
      }
      throw new UnauthorizedException('Invalid demo token format')
    }

    try {
      const payload = await this.cognitoJwtVerifier.verify(token)

      // Extract user information from JWT claims
      const user: CognitoUser = {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        org_id: payload['custom:org_id'] || '',
        role: payload['custom:role'] || 'SUPPORT',
        purpose_of_use: payload['custom:purpose_of_use'],
        groups: payload['cognito:groups'] || [],
        mfa_enabled: payload['custom:mfa_enabled'] === 'true',
        last_login_at: payload['custom:last_login_at'] || new Date().toISOString(),
      }

      logger.info({
        action: 'TOKEN_VALIDATED',
        user_id: user.sub,
        org_id: user.org_id,
        role: user.role,
        groups: user.groups,
      })

      return user
    } catch (error) {
      logger.warn({
        action: 'TOKEN_VALIDATION_FAILED',
        error: (error as Error).message,
      })
      throw new UnauthorizedException('Invalid or expired token')
    }
  }

  /**
   * Parse mock token for demo mode
   */
  private parseMockToken(token: string): CognitoUser {
    // Mock token format: mock_access_{role}_{orgId}_{userId}
    const parts = token.split('_')
    if (parts.length < 5) {
      throw new UnauthorizedException('Invalid mock token format')
    }

    const role = parts[2]?.toUpperCase() || 'SUPPORT'
    const orgId = parts[3] || 'demo-org'
    const userId = parts[4] || 'demo-user'

    return {
      sub: userId,
      email: `${role.toLowerCase()}@example.com`,
      email_verified: true,
      org_id: orgId,
      role: role,
      purpose_of_use: 'TREATMENT',
      groups: [role],
      mfa_enabled: false,
      last_login_at: new Date().toISOString(),
    }
  }

  /**
   * Authenticate user in demo mode
   */
  private authenticateDemoUser(email: string, password: string): LoginResponse {
    // Demo users for testing different roles
    const demoUsers: Record<string, { password: string; role: string; orgId: string }> = {
      'admin@example.com': { password: 'password', role: 'ADMIN', orgId: 'demo-org-123' },
      'doctor@example.com': { password: 'password', role: 'DOCTOR', orgId: 'demo-org-123' },
      'lab@example.com': { password: 'password', role: 'LAB_TECH', orgId: 'demo-org-123' },
      'pharmacist@example.com': { password: 'password', role: 'PHARMACIST', orgId: 'demo-org-123' },
      'marketer@example.com': { password: 'password', role: 'MARKETER', orgId: 'demo-org-456' },
      'support@example.com': { password: 'password', role: 'SUPPORT', orgId: 'demo-org-123' },
      'super@example.com': { password: 'password', role: 'SUPER_ADMIN', orgId: 'demo-org-123' },
      'auditor@example.com': { password: 'password', role: 'AUDITOR', orgId: 'demo-org-123' },
    }

    const demoUser = demoUsers[email.toLowerCase()]

    if (!demoUser || demoUser.password !== password) {
      logger.warn({
        action: 'DEMO_AUTH_FAILED',
        email: email,
        reason: 'Invalid credentials or user not found'
      })
      throw new UnauthorizedException('Invalid demo credentials')
    }

    // Generate mock token with role information
    const userId = `demo-user-${Date.now()}`
    const mockToken = `mock_access_${demoUser.role.toLowerCase()}_${demoUser.orgId}_${userId}`

    const user: CognitoUser = {
      sub: userId,
      email: email,
      email_verified: true,
      org_id: demoUser.orgId,
      role: demoUser.role,
      purpose_of_use: 'TREATMENT',
      groups: [demoUser.role],
      mfa_enabled: false,
      last_login_at: new Date().toISOString(),
    }

    logger.info({
      action: 'DEMO_USER_AUTHENTICATED',
      user_id: userId,
      email: email,
      role: demoUser.role,
      org_id: demoUser.orgId,
    })

    return {
      access_token: mockToken,
      refresh_token: `mock_refresh_${Date.now()}`,
      expires_in: 3600,
      token_type: 'Bearer',
      accessToken: mockToken,
      user,
    }
  }

  /**
   * Authenticate user with email/password
   */
  async authenticate(email: string, password: string): Promise<LoginResponse> {
    if (this.demoMode) {
      // Demo mode authentication - validate against mock users
      return this.authenticateDemoUser(email, password)
    }

    try {
      // Import AWS SDK dynamically to avoid issues if not configured
      const { CognitoIdentityProviderClient, InitiateAuthCommand, AdminGetUserCommand } = await import('@aws-sdk/client-cognito-identity-provider')

      const client = new CognitoIdentityProviderClient({
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      })

      // Authenticate user
      const authCommand = new InitiateAuthCommand({
        ClientId: this.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      })

      const authResult = await client.send(authCommand)

      if (!authResult.AuthenticationResult) {
        throw new UnauthorizedException('Authentication failed')
      }

      // Get user details
      const userCommand = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      })

      const userResult = await client.send(userCommand)

      // Extract user attributes
      const attributes = userResult.UserAttributes?.reduce((acc, attr) => {
        acc[attr.Name!] = attr.Value!
        return acc
      }, {} as Record<string, string>) || {}

      const user: CognitoUser = {
        sub: userResult.Username!,
        email: attributes['email'] || email,
        email_verified: attributes['email_verified'] === 'true',
        org_id: attributes['custom:org_id'] || '',
        role: this.mapRole(attributes['custom:role']) || 'SUPPORT',
        purpose_of_use: attributes['custom:purpose_of_use'],
        groups: attributes['cognito:groups']?.split(',') || [],
        mfa_enabled: attributes['custom:mfa_enabled'] === 'true',
        last_login_at: new Date().toISOString(),
      }

      const response: LoginResponse = {
        access_token: authResult.AuthenticationResult.AccessToken!,
        refresh_token: authResult.AuthenticationResult.RefreshToken!,
        expires_in: authResult.AuthenticationResult.ExpiresIn!,
        token_type: authResult.AuthenticationResult.TokenType!,
        accessToken: authResult.AuthenticationResult.AccessToken!,  // Alias for compatibility
        user,
      }

      logger.info({
        action: 'USER_AUTHENTICATED',
        user_id: user.sub,
        org_id: user.org_id,
        role: user.role,
      })

      return response
    } catch (error) {
      logger.error({
        action: 'AUTHENTICATION_FAILED',
        email: email,
        error: (error as Error).message,
      })
      throw new UnauthorizedException('Invalid credentials')
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    if (this.demoMode) {
      // Return mock refresh response for demo mode
      return {
        access_token: `mock_access_refreshed_${Date.now()}`,
        refresh_token: `mock_refresh_new_${Date.now()}`,
        expires_in: 900, // 15 minutes
        token_type: 'Bearer',
        accessToken: `mock_access_refreshed_${Date.now()}`,  // Alias for compatibility
      }
    }

    try {
      // Import AWS SDK dynamically
      const { CognitoIdentityProviderClient, InitiateAuthCommand } = await import('@aws-sdk/client-cognito-identity-provider')

      const client = new CognitoIdentityProviderClient({
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      })

      // Refresh token
      const refreshCommand = new InitiateAuthCommand({
        ClientId: this.clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      })

      const refreshResult = await client.send(refreshCommand)

      if (!refreshResult.AuthenticationResult) {
        throw new UnauthorizedException('Token refresh failed')
      }

      const response: RefreshResponse = {
        access_token: refreshResult.AuthenticationResult.AccessToken!,
        refresh_token: refreshResult.AuthenticationResult.RefreshToken!,
        expires_in: refreshResult.AuthenticationResult.ExpiresIn!,
        token_type: refreshResult.AuthenticationResult.TokenType!,
        accessToken: refreshResult.AuthenticationResult.AccessToken!,  // Alias for compatibility
      }

      logger.info({
        action: 'TOKEN_REFRESHED',
      })

      return response
    } catch (error) {
      logger.error({
        action: 'TOKEN_REFRESH_FAILED',
        error: (error as Error).message,
      })
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  /**
   * Logout user by invalidating refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    if (this.demoMode) {
      // Mock logout for demo mode
      logger.info({
        action: 'USER_LOGGED_OUT',
      })
      return
    }

    try {
      // Import AWS SDK dynamically
      const { CognitoIdentityProviderClient, RevokeTokenCommand } = await import('@aws-sdk/client-cognito-identity-provider')

      const client = new CognitoIdentityProviderClient({
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      })

      // Revoke the refresh token
      const revokeCommand = new RevokeTokenCommand({
        ClientId: this.clientId,
        Token: refreshToken,
      })

      await client.send(revokeCommand)

      logger.info({
        action: 'USER_LOGGED_OUT',
      })
    } catch (error) {
      logger.error({
        action: 'LOGOUT_FAILED',
        error: (error as Error).message,
      })
      throw new UnauthorizedException('Logout failed')
    }
  }

  /**
   * Get user profile by user ID
   */
  async getUserProfile(userId: string): Promise<CognitoUser> {
    if (this.demoMode) {
      // Return mock user for demo mode
      return {
        sub: userId,
        email: 'user@example.com',
        email_verified: true,
        org_id: 'org_123',
        role: 'DOCTOR',
        purpose_of_use: 'TREATMENT',
        groups: ['DOCTOR'],
        mfa_enabled: false,
        last_login_at: new Date().toISOString(),
      }
    }

    try {
      // Import AWS SDK dynamically
      const { CognitoIdentityProviderClient, AdminGetUserCommand, ListUsersCommand } = await import('@aws-sdk/client-cognito-identity-provider')

      const client = new CognitoIdentityProviderClient({
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
      })

      // First try to get user by username (email)
      try {
        const userCommand = new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: userId,
        })

        const userResult = await client.send(userCommand)

        // Extract user attributes
        const attributes = userResult.UserAttributes?.reduce((acc, attr) => {
          acc[attr.Name!] = attr.Value!
          return acc
        }, {} as Record<string, string>) || {}

        const user: CognitoUser = {
          sub: userResult.Username!,
          email: attributes['email'] || userId,
          email_verified: attributes['email_verified'] === 'true',
          org_id: attributes['custom:org_id'] || '',
          role: this.mapRole(attributes['custom:role']) || 'SUPPORT',
          purpose_of_use: attributes['custom:purpose_of_use'],
          groups: attributes['cognito:groups']?.split(',') || [],
          mfa_enabled: attributes['custom:mfa_enabled'] === 'true',
          last_login_at: attributes['custom:last_login_at'] || new Date().toISOString(),
        }

        logger.info({
          action: 'USER_PROFILE_RETRIEVED',
          user_id: userId,
        })

        return user
      } catch {
        // If not found by username, try searching by sub in user attributes
        const listCommand = new ListUsersCommand({
          UserPoolId: this.userPoolId,
          Filter: `username = "${userId}"`,
        })

        const listResult = await client.send(listCommand)

        if (listResult.Users && listResult.Users.length > 0) {
          const user = listResult.Users[0]
          if (!user) {
            throw new Error('User not found')
          }

          const attributes = user.Attributes?.reduce((acc, attr) => {
            if (attr.Name && attr.Value) {
              acc[attr.Name] = attr.Value
            }
            return acc
          }, {} as Record<string, string>) || {}

          const userProfile: CognitoUser = {
            sub: user.Username!,
            email: attributes['email'] || userId,
            email_verified: attributes['email_verified'] === 'true',
            org_id: attributes['custom:org_id'] || '',
            role: this.mapRole(attributes['custom:role']) || 'SUPPORT',
            purpose_of_use: attributes['custom:purpose_of_use'],
            groups: attributes['cognito:groups']?.split(',') || [],
            mfa_enabled: attributes['custom:mfa_enabled'] === 'true',
            last_login_at: attributes['custom:last_login_at'] || new Date().toISOString(),
          }

          logger.info({
            action: 'USER_PROFILE_RETRIEVED',
            user_id: userId,
          })

          return userProfile
        }

        throw new Error('User not found')
      }
    } catch (error) {
      logger.error({
        action: 'GET_USER_PROFILE_FAILED',
        user_id: userId,
        error: (error as Error).message,
      })
      throw new UnauthorizedException('User not found')
    }
  }

  /**
   * Check if user has specific role
   */
  hasRole(user: CognitoUser, requiredRole: string): boolean {
    return user.role === requiredRole || user.groups.includes(requiredRole)
  }

  /**
   * Check if user has any of the required roles
   */
  hasAnyRole(user: CognitoUser, requiredRoles: string[]): boolean {
    return requiredRoles.some(role => this.hasRole(user, role))
  }

  /**
   * Check if user is super admin
   */
  isSuperAdmin(user: CognitoUser): boolean {
    return user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.groups.includes('SUPER_ADMIN') || user.groups.includes('ADMIN')
  }

  /**
   * Check if user is marketer admin
   */
  isMarketerAdmin(user: CognitoUser): boolean {
    return user.role === 'MARKETER_ADMIN' || user.groups.includes('MARKETER_ADMIN')
  }

  /**
   * Validate purpose of use
   */
  validatePurposeOfUse(user: CognitoUser, purpose: string): boolean {
    const allowedPurposes = ['TREATMENT', 'PAYMENT', 'HEALTHCARE_OPERATIONS']
    return allowedPurposes.includes(purpose) && user.purpose_of_use === purpose
  }

  /**
   * Map database role names to API role names
   */
  private mapRole(dbRole: string | undefined): string {
    if (!dbRole) return 'SUPPORT'

    const roleMap: Record<string, string> = {
      'ADMIN': 'ADMIN',
      'ORG_ADMIN': 'ORG_ADMIN',
      'ORG_MANAGER': 'ADMIN', // Map old ORG_MANAGER to ADMIN
      'DOCTOR': 'DOCTOR',
      'LAB_TECH': 'LAB_TECH',
      'PHARMACIST': 'PHARMACIST',
      'MARKETER': 'MARKETER',
      'SUPPORT': 'SUPPORT',
      'AUDITOR': 'AUDITOR',
    }

    return roleMap[dbRole] || 'SUPPORT'
  }

  /**
   * Get secret from AWS Secrets Manager
   */
  private async getSecret(secretArn: string): Promise<string> {
    try {
      const command = new GetSecretValueCommand({
        SecretId: secretArn,
      })

      const response = await this.secretsClient!.send(command)

      if (response.SecretString) {
        return response.SecretString
      }

      throw new Error('Secret not found')
    } catch (error) {
      logger.error({
        action: 'GET_SECRET_FAILED',
        secret_arn: secretArn,
        error: (error as Error).message,
      })
      throw error
    }
  }

  // Mock admin methods for development
  async createUser(userData: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    orgId: string;
  }): Promise<string> {
    try {
      // Mock implementation for development
      const mockUserId = `cognito_${Date.now()}`;
      
      logger.info({
        action: 'USER_CREATED',
        user_id: mockUserId,
        email: userData.email,
        role: userData.role,
        org_id: userData.orgId,
      });

      return mockUserId;
    } catch (error) {
      logger.error({
        action: 'CREATE_USER_FAILED',
        email: userData.email,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async updateUser(userId: string, userData: {
    firstName?: string;
    lastName?: string;
    role?: string;
    purposeOfUse?: string;
    phoneNumber?: string;
    department?: string;
    isActive?: boolean;
  }): Promise<void> {
    try {
      logger.info({
        action: 'USER_UPDATED',
        user_id: userId,
        updates: userData,
      });
    } catch (error) {
      logger.error({
        action: 'UPDATE_USER_FAILED',
        user_id: userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async deactivateUser(userId: string): Promise<void> {
    try {
      logger.info({
        action: 'USER_DEACTIVATED',
        user_id: userId,
      });
    } catch (error) {
      logger.error({
        action: 'DEACTIVATE_USER_FAILED',
        user_id: userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async activateUser(userId: string): Promise<void> {
    try {
      logger.info({
        action: 'USER_ACTIVATED',
        user_id: userId,
      });
    } catch (error) {
      logger.error({
        action: 'ACTIVATE_USER_FAILED',
        user_id: userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async changeUserPassword(userId: string, newPassword: string, temporaryPassword: boolean = false): Promise<void> {
    try {
      logger.info({
        action: 'USER_PASSWORD_CHANGED',
        user_id: userId,
        temporary_password: temporaryPassword,
      });
    } catch (error) {
      logger.error({
        action: 'CHANGE_PASSWORD_FAILED',
        user_id: userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async resendInvitation(userId: string): Promise<void> {
    try {
      logger.info({
        action: 'INVITATION_RESENT',
        user_id: userId,
      });
    } catch (error) {
      logger.error({
        action: 'RESEND_INVITATION_FAILED',
        user_id: userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      logger.info({
        action: 'USER_DELETED',
        user_id: userId,
      });
    } catch (error) {
      logger.error({
        action: 'DELETE_USER_FAILED',
        user_id: userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async listUsers(orgId: string, limit: number = 50, paginationToken?: string): Promise<{
    users: CognitoUser[];
    paginationToken?: string;
  }> {
    try {
      // Mock implementation for development
      const mockUsers: CognitoUser[] = [
        {
          sub: 'user_1',
          email: 'user1@example.com',
          email_verified: true,
          org_id: orgId,
          role: 'DOCTOR',
          purpose_of_use: 'TREATMENT',
          groups: ['DOCTOR'],
          mfa_enabled: false,
          last_login_at: new Date().toISOString(),
        },
        {
          sub: 'user_2',
          email: 'user2@example.com',
          email_verified: true,
          org_id: orgId,
          role: 'LAB_TECH',
          purpose_of_use: 'TREATMENT',
          groups: ['LAB_TECH'],
          mfa_enabled: false,
          last_login_at: new Date().toISOString(),
        },
      ];

      logger.info({
        action: 'USERS_LISTED',
        org_id: orgId,
        count: mockUsers.length,
      });

      return {
        users: mockUsers,
        paginationToken: paginationToken ? `next_${Date.now()}` : undefined,
      };
    } catch (error) {
      logger.error({
        action: 'LIST_USERS_FAILED',
        org_id: orgId,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}