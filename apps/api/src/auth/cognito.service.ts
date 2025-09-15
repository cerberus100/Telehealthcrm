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

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const userPoolId = this.configService.get<string>('COGNITO_USER_POOL_ID')
    const clientId = this.configService.get<string>('COGNITO_CLIENT_ID')
    const demoMode = this.configService.get<string>('API_DEMO_MODE') === 'true'
    
    // In demo mode, skip AWS configuration
    if (demoMode) {
      this.userPoolId = 'demo-pool-id'
      this.clientId = 'demo-client-id'
      this.cognitoJwtVerifier = null
      this.secretsClient = null
      return
    }
    
    if (!userPoolId || !clientId) {
      throw new Error('COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be configured')
    }

    this.userPoolId = userPoolId
    this.clientId = clientId

    this.cognitoJwtVerifier = CognitoJwtVerifier.create({
      userPoolId: this.userPoolId,
      tokenUse: 'access',
      clientId: this.clientId,
    })

    this.secretsClient = new SecretsManagerClient({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
    })
  }

  /**
   * Validate JWT token and extract user claims
   */
  async validateToken(token: string): Promise<CognitoUser> {
    const demoMode = this.configService.get<string>('API_DEMO_MODE') === 'true'
    
    if (demoMode) {
      // Return mock user for demo mode
      return {
        sub: 'demo-user-123',
        email: 'demo@example.com',
        email_verified: true,
        org_id: 'demo-org-123',
        role: 'ADMIN',
        purpose_of_use: 'TREATMENT',
        groups: ['ADMIN'],
        mfa_enabled: false,
        last_login_at: new Date().toISOString(),
      }
    }

    try {
      const payload = await this.cognitoJwtVerifier.verify(token)
      
      // Extract user information from JWT claims
      const user: CognitoUser = {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        org_id: payload['custom:org_id'],
        role: payload['custom:role'],
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
   * Authenticate user with email/password
   */
  async authenticate(email: string, password: string): Promise<LoginResponse> {
    const demoMode = this.configService.get<string>('API_DEMO_MODE') === 'true'
    
    if (demoMode) {
      // Return mock login response for demo mode
      return {
        access_token: 'demo_access_token',
        refresh_token: 'demo_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
        accessToken: 'demo_access_token',  // Alias for compatibility
        user: {
          sub: 'demo-user-123',
          email: email,
          email_verified: true,
          org_id: 'demo-org-123',
          role: 'ADMIN',
          purpose_of_use: 'TREATMENT',
          groups: ['ADMIN'],
          mfa_enabled: false,
          last_login_at: new Date().toISOString(),
        }
      }
    }

    try {
      // TODO: Implement actual Cognito authentication
      // For now, return mock response for development
      
      // In production, this would use AWS SDK CognitoIdentityServiceProvider
      const mockUser: CognitoUser = {
        sub: 'user_123',
        email: email,
        email_verified: true,
        org_id: 'org_123',
        role: 'DOCTOR',
        purpose_of_use: 'TREATMENT',
        groups: ['DOCTOR'],
        mfa_enabled: false,
        last_login_at: new Date().toISOString(),
      }

      const mockResponse: LoginResponse = {
        access_token: `mock_access_${Date.now()}`,
        refresh_token: `mock_refresh_${Date.now()}`,
        expires_in: 3600,
        token_type: 'Bearer',
        accessToken: `mock_access_${Date.now()}`,  // Alias for compatibility
        user: mockUser,
      }

      logger.info({
        action: 'USER_AUTHENTICATED',
        user_id: mockUser.sub,
        org_id: mockUser.org_id,
        role: mockUser.role,
      })

      return mockResponse
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
    try {
      // TODO: Implement actual Cognito token refresh
      // For now, return mock response for development
      
      const mockResponse: RefreshResponse = {
        access_token: `mock_access_refreshed_${Date.now()}`,
        refresh_token: `mock_refresh_new_${Date.now()}`,
        expires_in: 900, // 15 minutes
        token_type: 'Bearer',
        accessToken: `mock_access_refreshed_${Date.now()}`,  // Alias for compatibility
      }

      logger.info({
        action: 'TOKEN_REFRESHED',
      })

      return mockResponse
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
    try {
      // TODO: Implement actual Cognito logout
      // For now, just log the action
      
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
    try {
      // TODO: Implement actual Cognito user profile retrieval
      // For now, return mock user
      
      const mockUser: CognitoUser = {
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

      logger.info({
        action: 'USER_PROFILE_RETRIEVED',
        user_id: userId,
      })

      return mockUser
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
    return user.role === 'ADMIN' || user.groups.includes('ADMIN')
  }

  /**
   * Check if user is marketer admin
   */
  isMarketerAdmin(user: CognitoUser): boolean {
    return user.role === 'MARKETER' && user.groups.includes('MARKETER_ADMIN')
  }

  /**
   * Validate purpose of use
   */
  validatePurposeOfUse(user: CognitoUser, purpose: string): boolean {
    const allowedPurposes = ['TREATMENT', 'PAYMENT', 'HEALTHCARE_OPERATIONS']
    return allowedPurposes.includes(purpose) && user.purpose_of_use === purpose
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