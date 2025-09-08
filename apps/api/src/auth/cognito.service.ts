import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common'
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
}

export interface RefreshResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

@Injectable()
export class CognitoService {
  private readonly cognitoJwtVerifier: any
  private readonly secretsClient: SecretsManagerClient
  private readonly userPoolId: string
  private readonly clientId: string

  constructor(private configService: ConfigService) {
    const userPoolId = this.configService.get<string>('COGNITO_USER_POOL_ID')
    const clientId = this.configService.get<string>('COGNITO_CLIENT_ID')
    
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
    try {
      const payload = await this.cognitoJwtVerifier.verify(token)
      
      // Extract user information from JWT claims
      const user: CognitoUser = {
        sub: payload.sub,
        email: payload.email,
        email_verified: payload.email_verified,
        org_id: payload['custom:org_id'] || payload.org_id,
        role: payload['custom:role'] || payload.role,
        purpose_of_use: payload['custom:purpose_of_use'] || payload.purpose_of_use,
        groups: payload['cognito:groups'] || [],
        mfa_enabled: payload['cognito:username'] ? true : false, // Simplified MFA check
        last_login_at: new Date(payload.iat * 1000).toISOString(),
      }

      // Validate required fields
      if (!user.sub || !user.email || !user.org_id || !user.role) {
        throw new UnauthorizedException('Invalid token claims')
      }

      // Log successful token validation (without PHI)
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
    try {
      // TODO: Implement actual Cognito authentication
      // For now, return mock response for development
      
      // In production, this would use AWS SDK CognitoIdentityServiceProvider
      const mockUser: CognitoUser = {
        sub: 'user_123',
        email: email,
        email_verified: true,
        org_id: 'org_123',
        role: 'MARKETER',
        groups: ['MARKETER'],
        mfa_enabled: false,
        last_login_at: new Date().toISOString(),
      }

      const mockResponse: LoginResponse = {
        access_token: `mock_access_${mockUser.sub}_${Date.now()}`,
        refresh_token: `mock_refresh_${mockUser.sub}_${Date.now()}`,
        expires_in: 900, // 15 minutes
        token_type: 'Bearer',
        user: mockUser,
      }

      // Log successful authentication (without PHI)
      logger.info({
        action: 'USER_AUTHENTICATED',
        user_id: mockUser.sub,
        org_id: mockUser.org_id,
        role: mockUser.role,
        email_verified: mockUser.email_verified,
      })

      return mockResponse
    } catch (error) {
      logger.warn({
        action: 'AUTHENTICATION_FAILED',
        email: email, // Log email for security monitoring
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
      }

      logger.info({
        action: 'TOKEN_REFRESHED',
      })

      return mockResponse
    } catch (error) {
      logger.warn({
        action: 'TOKEN_REFRESH_FAILED',
        error: (error as Error).message,
      })
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  /**
   * Logout user and invalidate tokens
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      // TODO: Implement actual Cognito logout
      // This would call CognitoIdentityServiceProvider.revokeToken()
      
      logger.info({
        action: 'USER_LOGOUT',
      })
    } catch (error) {
      logger.warn({
        action: 'LOGOUT_FAILED',
        error: (error as Error).message,
      })
      // Don't throw error on logout failure
    }
  }

  /**
   * Get user profile from Cognito
   */
  async getUserProfile(userId: string): Promise<CognitoUser> {
    try {
      // TODO: Implement actual Cognito user profile retrieval
      // This would use CognitoIdentityServiceProvider.adminGetUser()
      
      const mockUser: CognitoUser = {
        sub: userId,
        email: 'user@example.com',
        email_verified: true,
        org_id: 'org_123',
        role: 'MARKETER',
        groups: ['MARKETER'],
        mfa_enabled: false,
        last_login_at: new Date().toISOString(),
      }

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
   * Check if user has required role
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
   * Check if user is SUPER_ADMIN
   */
  isSuperAdmin(user: CognitoUser): boolean {
    return this.hasRole(user, 'SUPER_ADMIN')
  }

  /**
   * Check if user is MARKETER_ADMIN
   */
  isMarketerAdmin(user: CognitoUser): boolean {
    return this.hasRole(user, 'MARKETER_ADMIN')
  }

  /**
   * Validate purpose of use for PHI access
   */
  validatePurposeOfUse(user: CognitoUser, purpose: string): boolean {
    // For now, accept any purpose if user has one
    // In production, this would validate against allowed purposes
    return !!user.purpose_of_use
  }

  /**
   * Get secret from AWS Secrets Manager
   */
  private async getSecret(secretArn: string): Promise<string> {
    try {
      const command = new GetSecretValueCommand({
        SecretId: secretArn,
      })
      
      const response = await this.secretsClient.send(command)
      
      if (response.SecretString) {
        return response.SecretString
      }
      
      throw new Error('Secret not found or empty')
    } catch (error) {
      logger.error({
        action: 'GET_SECRET_FAILED',
        secret_arn: secretArn,
        error: (error as Error).message,
      })
      throw new Error('Failed to retrieve secret')
    }
  }

  // Admin User Management Methods

  /**
   * Create a new user in Cognito
   */
  async createUser(userData: {
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    orgId: string;
  }): Promise<string> {
    try {
      // TODO: Implement actual Cognito user creation
      // This would use CognitoIdentityServiceProvider.adminCreateUser()
      
      // For development, return mock user ID
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
      throw new Error('Failed to create user');
    }
  }

  /**
   * Update user attributes in Cognito
   */
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
      // TODO: Implement actual Cognito user update
      // This would use CognitoIdentityServiceProvider.adminUpdateUserAttributes()
      
      logger.info({
        action: 'USER_UPDATED',
        user_id: userId,
        updated_fields: Object.keys(userData),
      });
    } catch (error) {
      logger.error({
        action: 'UPDATE_USER_FAILED',
        user_id: userId,
        error: (error as Error).message,
      });
      throw new Error('Failed to update user');
    }
  }

  /**
   * Deactivate user in Cognito
   */
  async deactivateUser(userId: string): Promise<void> {
    try {
      // TODO: Implement actual Cognito user deactivation
      // This would use CognitoIdentityServiceProvider.adminDisableUser()
      
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
      throw new Error('Failed to deactivate user');
    }
  }

  /**
   * Activate user in Cognito
   */
  async activateUser(userId: string): Promise<void> {
    try {
      // TODO: Implement actual Cognito user activation
      // This would use CognitoIdentityServiceProvider.adminEnableUser()
      
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
      throw new Error('Failed to activate user');
    }
  }

  /**
   * Change user password in Cognito
   */
  async changeUserPassword(userId: string, newPassword: string, temporaryPassword: boolean = false): Promise<void> {
    try {
      // TODO: Implement actual Cognito password change
      // This would use CognitoIdentityServiceProvider.adminSetUserPassword()
      
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
      throw new Error('Failed to change user password');
    }
  }

  /**
   * Resend invitation to user
   */
  async resendInvitation(userId: string): Promise<void> {
    try {
      // TODO: Implement actual Cognito invitation resend
      // This would use CognitoIdentityServiceProvider.adminCreateUser() with MessageAction: 'RESEND'
      
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
      throw new Error('Failed to resend invitation');
    }
  }

  /**
   * Delete user from Cognito
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      // TODO: Implement actual Cognito user deletion
      // This would use CognitoIdentityServiceProvider.adminDeleteUser()
      
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
      throw new Error('Failed to delete user');
    }
  }

  /**
   * List users in organization
   */
  async listUsers(orgId: string, limit: number = 50, paginationToken?: string): Promise<{
    users: CognitoUser[];
    paginationToken?: string;
  }> {
    try {
      // TODO: Implement actual Cognito user listing
      // This would use CognitoIdentityServiceProvider.listUsers() with filters
      
      // For development, return mock users
      const mockUsers: CognitoUser[] = [
        {
          sub: 'user_1',
          email: 'admin@example.com',
          email_verified: true,
          org_id: orgId,
          role: 'ADMIN',
          groups: ['ADMIN'],
          mfa_enabled: false,
          last_login_at: new Date().toISOString(),
        },
        {
          sub: 'user_2',
          email: 'doctor@example.com',
          email_verified: true,
          org_id: orgId,
          role: 'DOCTOR',
          groups: ['DOCTOR'],
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
        paginationToken: undefined,
      };
    } catch (error) {
      logger.error({
        action: 'LIST_USERS_FAILED',
        org_id: orgId,
        error: (error as Error).message,
      });
      throw new Error('Failed to list users');
    }
  }
}
