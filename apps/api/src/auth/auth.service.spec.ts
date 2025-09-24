import { Test, TestingModule } from '@nestjs/testing'
import { AuthService } from '../services/auth.service'
import { CognitoService } from './cognito.service'
import { PrismaService } from '../prisma.service'
import { UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Role } from '../types/claims'

describe('AuthService', () => {
  let service: AuthService
  let cognitoService: CognitoService
  let prismaService: PrismaService

  const mockCognitoService = {
    authenticate: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    getUserProfile: jest.fn(),
    validateToken: jest.fn(),
  }

  const mockPrismaService = {
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CognitoService,
          useValue: mockCognitoService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'API_DEMO_MODE': 'false',
                'COGNITO_USER_POOL_ID': 'test-pool',
                'COGNITO_CLIENT_ID': 'test-client',
                'AWS_REGION': 'us-east-1',
              }
              return config[key as keyof typeof config]
            }),
          },
        },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    cognitoService = module.get<CognitoService>(CognitoService)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('login', () => {
    it('should successfully authenticate user', async () => {
      const loginDto = { email: 'test@example.com', password: 'password123' }
      const mockLoginResponse = {
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        expires_in: 3600,
        token_type: 'Bearer',
        user: {
          sub: 'user123',
          email: 'test@example.com',
          email_verified: true,
          org_id: 'org123',
          role: 'DOCTOR',
          purpose_of_use: 'TREATMENT',
          groups: ['DOCTOR'],
          mfa_enabled: false,
          last_login_at: new Date().toISOString(),
        },
      }

      mockCognitoService.authenticate.mockResolvedValue(mockLoginResponse)
      mockPrismaService.user.update.mockResolvedValue({ id: 'user123' })

      const result = await service.login(loginDto)

      expect(result).toEqual({
        access_token: 'access_token_123',
        refresh_token: 'refresh_token_123',
        expires_in: 3600,
        token_type: 'Bearer',
      })
      expect(mockCognitoService.authenticate).toHaveBeenCalledWith('test@example.com', 'password123')
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: { lastLoginAt: expect.any(Date) },
      })
    })

    it('should handle authentication failure', async () => {
      const loginDto = { email: 'test@example.com', password: 'wrongpassword' }

      mockCognitoService.authenticate.mockRejectedValue(new UnauthorizedException('Invalid credentials'))

      await expect(service.login(loginDto)).rejects.toThrow('Invalid credentials')
    })
  })

  describe('refresh', () => {
    it('should successfully refresh token', async () => {
      const refreshDto = { refresh_token: 'refresh_token_123' }
      const mockRefreshResponse = {
        access_token: 'new_access_token_123',
        refresh_token: 'new_refresh_token_123',
        expires_in: 900,
        token_type: 'Bearer',
      }

      mockCognitoService.refreshToken.mockResolvedValue(mockRefreshResponse)

      const result = await service.refresh(refreshDto)

      expect(result).toEqual({
        access_token: 'new_access_token_123',
        refresh_token: 'new_refresh_token_123',
        expires_in: 900,
        token_type: 'Bearer',
      })
      expect(mockCognitoService.refreshToken).toHaveBeenCalledWith('refresh_token_123')
    })

    it('should handle refresh failure', async () => {
      const refreshDto = { refresh_token: 'invalid_refresh_token' }

      mockCognitoService.refreshToken.mockRejectedValue(new UnauthorizedException('Invalid refresh token'))

      await expect(service.refresh(refreshDto)).rejects.toThrow('Invalid refresh token')
    })
  })

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const logoutDto = { refresh_token: 'refresh_token_123' }

      mockCognitoService.logout.mockResolvedValue(undefined)

      const result = await service.logout(logoutDto)

      expect(result).toEqual({ success: true })
      expect(mockCognitoService.logout).toHaveBeenCalledWith('refresh_token_123')
    })

    it('should handle logout failure gracefully', async () => {
      const logoutDto = { refresh_token: 'invalid_refresh_token' }

      mockCognitoService.logout.mockRejectedValue(new Error('Logout failed'))

      const result = await service.logout(logoutDto)

      expect(result).toEqual({ success: true })
      expect(mockCognitoService.logout).toHaveBeenCalledWith('invalid_refresh_token')
    })
  })

  describe('getMe', () => {
    it('should return user profile and organization', async () => {
      const claims = {
        sub: 'user123',
        orgId: 'org123',
        role: 'DOCTOR' as Role,
        purposeOfUse: 'TREATMENT',
      }

      const mockCognitoUser = {
        sub: 'user123',
        email: 'test@example.com',
        email_verified: true,
        org_id: 'org123',
        role: 'DOCTOR',
        purpose_of_use: 'TREATMENT',
        groups: ['DOCTOR'],
        mfa_enabled: false,
        last_login_at: new Date().toISOString(),
      }

      const mockOrganization = {
        id: 'org123',
        type: 'PROVIDER',
        name: 'Test Organization',
      }

      mockCognitoService.getUserProfile.mockResolvedValue(mockCognitoUser)
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization)

      const result = await service.getMe(claims)

      expect(result).toEqual({
        user: {
          id: 'user123',
          email: 'test@example.com',
          role: 'DOCTOR',
          org_id: 'org123',
          last_login_at: mockCognitoUser.last_login_at,
        },
        org: {
          id: 'org123',
          type: 'PROVIDER',
          name: 'Test Organization',
        },
      })
      expect(mockCognitoService.getUserProfile).toHaveBeenCalledWith('user123')
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 'org123' },
      })
    })

    it('should throw error when user not found in Cognito', async () => {
      const claims = {
        sub: 'nonexistent_user',
        orgId: 'org123',
        role: 'DOCTOR' as Role,
        purposeOfUse: 'TREATMENT',
      }

      mockCognitoService.getUserProfile.mockRejectedValue(new UnauthorizedException('User not found'))

      await expect(service.getMe(claims)).rejects.toThrow('User not found')
    })

    it('should throw error when organization not found', async () => {
      const claims = {
        sub: 'user123',
        orgId: 'nonexistent_org',
        role: 'DOCTOR' as Role,
        purposeOfUse: 'TREATMENT',
      }

      const mockCognitoUser = {
        sub: 'user123',
        email: 'test@example.com',
        email_verified: true,
        org_id: 'nonexistent_org',
        role: 'DOCTOR',
        purpose_of_use: 'TREATMENT',
        groups: ['DOCTOR'],
        mfa_enabled: false,
        last_login_at: new Date().toISOString(),
      }

      mockCognitoService.getUserProfile.mockResolvedValue(mockCognitoUser)
      mockPrismaService.organization.findUnique.mockResolvedValue(null)

      await expect(service.getMe(claims)).rejects.toThrow('Organization not found')
    })

    it('should throw error when claims are invalid', async () => {
      const invalidClaims = {
        sub: '',
        orgId: '',
        role: 'DOCTOR' as Role,
        purposeOfUse: 'TREATMENT',
      }

      await expect(service.getMe(invalidClaims)).rejects.toThrow('Invalid or missing claims')
    })
  })

  describe('getCurrentUser', () => {
    it('should return user and organization from database', async () => {
      const userId = 'user123'
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        role: 'DOCTOR',
        orgId: 'org123',
        lastLoginAt: new Date(),
        org: {
          id: 'org123',
          name: 'Test Organization',
          type: 'PROVIDER',
        },
      }

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser)

      const result = await service.getCurrentUser(userId)

      expect(result).toEqual({
        user: {
          id: 'user123',
          email: 'test@example.com',
          role: 'DOCTOR',
          org_id: 'org123',
          last_login_at: expect.any(String),
        },
        org: {
          id: 'org123',
          name: 'Test Organization',
          type: 'PROVIDER',
        },
      })
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user123' },
        include: { org: true },
      })
    })

    it('should throw error when user not found', async () => {
      const userId = 'nonexistent_user'

      mockPrismaService.user.findUnique.mockResolvedValue(null)

      await expect(service.getCurrentUser(userId)).rejects.toThrow('User not found')
    })
  })
})
