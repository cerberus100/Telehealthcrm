import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { CognitoService, CognitoUser } from '../auth/cognito.service'
import { LoginDto, RefreshDto, LogoutDto, MeResponseDto } from '../types/dto'
import { RequestClaims } from '../types/claims'
import { logger } from '../utils/logger'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private cognitoService: CognitoService
  ) {}

  async login(loginDto: LoginDto) {
    try {
      // Use Cognito service for authentication
      const loginResponse = await this.cognitoService.authenticate(
        loginDto.email,
        loginDto.password
      )

      // Update user's last login in database
      await this.updateUserLastLogin(loginResponse.user.sub)

      // Log successful login
      logger.info({
        action: 'USER_LOGIN_SUCCESS',
        user_id: loginResponse.user.sub,
        org_id: loginResponse.user.org_id,
        role: loginResponse.user.role,
      })

      return {
        access_token: loginResponse.access_token,
        refresh_token: loginResponse.refresh_token,
        expires_in: loginResponse.expires_in,
        token_type: loginResponse.token_type,
      }
    } catch (error) {
      logger.warn({
        action: 'USER_LOGIN_FAILED',
        email: loginDto.email,
        error: (error as Error).message,
      })
      throw error
    }
  }

  async refresh(refreshDto: RefreshDto) {
    try {
      // Use Cognito service for token refresh
      const refreshResponse = await this.cognitoService.refreshToken(
        refreshDto.refresh_token
      )

      logger.info({
        action: 'TOKEN_REFRESH_SUCCESS',
      })

      return {
        access_token: refreshResponse.access_token,
        refresh_token: refreshResponse.refresh_token,
        expires_in: refreshResponse.expires_in,
        token_type: refreshResponse.token_type,
      }
    } catch (error) {
      logger.warn({
        action: 'TOKEN_REFRESH_FAILED',
        error: (error as Error).message,
      })
      throw error
    }
  }

  async logout(logoutDto: LogoutDto) {
    try {
      // Use Cognito service for logout
      await this.cognitoService.logout(logoutDto.refresh_token)

      logger.info({
        action: 'USER_LOGOUT_SUCCESS',
      })

      return { success: true }
    } catch (error) {
      logger.warn({
        action: 'USER_LOGOUT_FAILED',
        error: (error as Error).message,
      })
      // Don't throw error on logout failure
      return { success: true }
    }
  }

  async getMe(claims: RequestClaims): Promise<MeResponseDto> {
    try {
      // Get user profile from Cognito
      const cognitoUser = await this.cognitoService.getUserProfile(claims.sub || '')

      // Get organization details from database
      const org = await this.prisma.organization.findUnique({
        where: { id: cognitoUser.org_id },
      })

      if (!org) {
        throw new UnauthorizedException('Organization not found')
      }

      const response: MeResponseDto = {
        user: {
          id: cognitoUser.sub,
          email: cognitoUser.email,
          role: cognitoUser.role as any,
          org_id: cognitoUser.org_id,
          last_login_at: cognitoUser.last_login_at,
        },
        org: {
          id: org.id,
          type: org.type,
          name: org.name,
        },
      }

      logger.info({
        action: 'GET_ME_SUCCESS',
        user_id: cognitoUser.sub,
        org_id: cognitoUser.org_id,
        role: cognitoUser.role,
      })

      return response
    } catch (error) {
      logger.error({
        action: 'GET_ME_FAILED',
        user_id: claims.sub,
        error: (error as Error).message,
      })
      throw error
    }
  }

  /**
   * Update user's last login timestamp in database
   */
  private async updateUserLastLogin(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      })
    } catch (error) {
      // Log but don't fail the login if database update fails
      logger.warn({
        action: 'UPDATE_LAST_LOGIN_FAILED',
        user_id: userId,
        error: (error as Error).message,
      })
    }
  }
}
