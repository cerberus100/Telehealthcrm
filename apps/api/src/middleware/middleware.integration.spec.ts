import { Test, TestingModule } from '@nestjs/testing'
import { Redis } from 'ioredis'
import { RateLimitMiddleware } from './rate-limit.middleware'
import { TenantMiddleware } from './tenant.middleware'
import { ClaimsMiddleware } from './claims.middleware'
import { CognitoService } from '../auth/cognito.service'
import { PrismaService } from '../prisma.service'
import { ConfigService } from '@nestjs/config'
import { Logger } from '@nestjs/common'

describe('Middleware Integration Tests', () => {
  let redis: Redis
  let rateLimitMiddleware: RateLimitMiddleware
  let tenantMiddleware: TenantMiddleware
  let claimsMiddleware: ClaimsMiddleware

  beforeAll(async () => {
    // Create a test module with only the necessary providers
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitMiddleware,
        TenantMiddleware,
        ClaimsMiddleware,
        {
          provide: CognitoService,
          useValue: {
            validateToken: jest.fn(),
            isSuperAdmin: jest.fn(),
            hasRole: jest.fn(),
            isMarketerAdmin: jest.fn(),
            hasAnyRole: jest.fn(),
            validatePurposeOfUse: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'API_DEMO_MODE': 'true', // Enable demo mode to skip AWS initialization
                'RATE_LIMIT_WINDOW_MS': 60000,
                'RATE_LIMIT_MAX_REQUESTS': 10,
                'REDIS_HOST': 'localhost',
                'REDIS_PORT': 6379,
                'COGNITO_USER_POOL_ID': 'test-pool',
                'COGNITO_CLIENT_ID': 'test-client',
                'AWS_REGION': 'us-east-1',
              }
              return config[key as keyof typeof config]
            }),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile()

    // Initialize middlewares
    rateLimitMiddleware = module.get<RateLimitMiddleware>(RateLimitMiddleware)
    tenantMiddleware = module.get<TenantMiddleware>(TenantMiddleware)
    claimsMiddleware = module.get<ClaimsMiddleware>(ClaimsMiddleware)

    // Mock Redis for testing
    redis = new Redis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: 0, // Disable retries for faster tests
    })

    // Clear Redis before tests
    await redis.flushdb()
  })

  afterAll(async () => {
    if (redis) {
      await redis.quit()
    }
  })

  beforeEach(async () => {
    // Clear Redis between tests
    await redis.flushdb()
  })

  describe('RateLimitMiddleware', () => {
    it('should allow requests within limit', async () => {
      const mockRequest = {
        headers: { authorization: 'Bearer test-token' },
        ip: '127.0.0.1',
        method: 'GET',
        routeOptions: { url: '/test' },
      } as any

      const mockReply = {
        header: jest.fn(),
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any

      const mockNext = jest.fn()

      // Mock CognitoService to return valid user
      const cognitoService = claimsMiddleware['cognitoService']
      jest.spyOn(cognitoService, 'validateToken').mockResolvedValue({
        sub: 'test-user',
        org_id: 'test-org',
        role: 'DOCTOR',
        email: 'test@example.com',
        email_verified: true,
        purpose_of_use: 'TREATMENT',
        groups: ['DOCTOR'],
        mfa_enabled: false,
        last_login_at: new Date().toISOString(),
      })

      // Mock ClaimsMiddleware to set claims
      await claimsMiddleware.use(mockRequest, mockReply, mockNext)

      // Should not call next yet (claims middleware should handle it)
      expect(mockNext).toHaveBeenCalled()
    })

    it('should rate limit exceeded requests', async () => {
      const mockRequest = {
        headers: { authorization: 'Bearer test-token' },
        ip: '127.0.0.1',
        method: 'GET',
        routeOptions: { url: '/test' },
      } as any

      const mockReply = {
        header: jest.fn(),
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as any

      // Make requests up to the limit
      for (let i = 0; i < 10; i++) {
        const mockNext = jest.fn()
        await rateLimitMiddleware.use(mockRequest, mockReply, mockNext)
        expect(mockNext).toHaveBeenCalled()
      }

      // Next request should be rate limited
      const mockNext = jest.fn()
      await expect(rateLimitMiddleware.use(mockRequest, mockReply, mockNext)).rejects.toThrow('Too many requests')

      // Should set proper headers
      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '0')
    })

    it('should use different keys for different users', async () => {
      const mockRequest1 = {
        headers: { authorization: 'Bearer token1' },
        ip: '127.0.0.1',
        method: 'GET',
        routeOptions: { url: '/test' },
      } as any

      const mockRequest2 = {
        headers: { authorization: 'Bearer token2' },
        ip: '127.0.0.1',
        method: 'GET',
        routeOptions: { url: '/test' },
      } as any

      // Mock different users
      const cognitoService = claimsMiddleware['cognitoService']
      jest.spyOn(cognitoService, 'validateToken')
        .mockResolvedValueOnce({
          sub: 'user1',
          org_id: 'org1',
          role: 'DOCTOR',
          email: 'user1@example.com',
          email_verified: true,
          purpose_of_use: 'TREATMENT',
          groups: ['DOCTOR'],
          mfa_enabled: false,
          last_login_at: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          sub: 'user2',
          org_id: 'org2',
          role: 'DOCTOR',
          email: 'user2@example.com',
          email_verified: true,
          purpose_of_use: 'TREATMENT',
          groups: ['DOCTOR'],
          mfa_enabled: false,
          last_login_at: new Date().toISOString(),
        })

      // Both users should be able to make requests independently
      const mockReply = { header: jest.fn() } as any

      // User 1 makes 5 requests
      for (let i = 0; i < 5; i++) {
        const mockNext = jest.fn()
        await rateLimitMiddleware.use(mockRequest1, mockReply, mockNext)
        expect(mockNext).toHaveBeenCalled()
      }

      // User 2 makes 5 requests
      for (let i = 0; i < 5; i++) {
        const mockNext = jest.fn()
        await rateLimitMiddleware.use(mockRequest2, mockReply, mockNext)
        expect(mockNext).toHaveBeenCalled()
      }

      // Neither should be rate limited yet
      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '5')
    })
  })

  describe('TenantMiddleware', () => {
    it('should resolve tenant context successfully', async () => {
      const mockRequest = {
        headers: { authorization: 'Bearer test-token' },
        method: 'GET',
        routeOptions: { url: '/test' },
      } as any

      const mockReply = {
        header: jest.fn(),
      } as any

      // Mock claims
      ;(mockRequest as any).claims = {
        sub: 'test-user',
        orgId: 'test-org',
        role: 'DOCTOR',
        purposeOfUse: 'TREATMENT',
      }

      // Mock PrismaService
      const prismaService = tenantMiddleware['prisma']
      jest.spyOn(prismaService.organization, 'findUnique').mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        type: 'PROVIDER',
        npi: null,
        address: null,
        contactInfo: null,
        settings: null,
        compliance: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const mockNext = jest.fn()
      await tenantMiddleware.use(mockRequest, mockReply, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect((mockRequest as any).tenant).toBeDefined()
      expect((mockRequest as any).tenant.orgId).toBe('test-org')
      expect((mockRequest as any).tenant.orgType).toBe('PROVIDER')

      // Should set headers
      expect(mockReply.header).toHaveBeenCalledWith('X-Tenant-ID', 'test-org')
      expect(mockReply.header).toHaveBeenCalledWith('X-Tenant-Type', 'PROVIDER')
      expect(mockReply.header).toHaveBeenCalledWith('X-Tenant-Name', 'Test Organization')
    })

    it('should handle missing organization', async () => {
      const mockRequest = {
        headers: { authorization: 'Bearer test-token' },
        method: 'GET',
        routeOptions: { url: '/test' },
      } as any

      const mockReply = {
        header: jest.fn(),
      } as any

      // Mock claims
      ;(mockRequest as any).claims = {
        sub: 'test-user',
        orgId: 'nonexistent-org',
        role: 'DOCTOR',
        purposeOfUse: 'TREATMENT',
      }

      // Mock PrismaService to return null
      const prismaService = tenantMiddleware['prisma']
      jest.spyOn(prismaService.organization, 'findUnique').mockResolvedValue(null as any)

      const mockNext = jest.fn()
      await expect(tenantMiddleware.use(mockRequest, mockReply, mockNext)).rejects.toThrow('Organization not found')
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle demo mode', async () => {
      // Enable demo mode
      const originalEnv = process.env.API_DEMO_MODE
      process.env.API_DEMO_MODE = 'true'

      const mockRequest = {
        headers: { authorization: 'Bearer test-token' },
        method: 'GET',
        routeOptions: { url: '/test' },
      } as any

      const mockReply = {
        header: jest.fn(),
      } as any

      // No claims needed in demo mode
      ;(mockRequest as any).claims = null

      const mockNext = jest.fn()
      await tenantMiddleware.use(mockRequest, mockReply, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect((mockRequest as any).tenant).toBeDefined()
      expect((mockRequest as any).tenant.orgId).toBe('mock-org-123')
      expect((mockRequest as any).tenant.orgType).toBe('PROVIDER')

      // Restore environment
      process.env.API_DEMO_MODE = originalEnv
    })
  })

  describe('Middleware Chain', () => {
    it('should work together in sequence', async () => {
      const mockRequest = {
        headers: { authorization: 'Bearer test-token' },
        ip: '127.0.0.1',
        method: 'GET',
        routeOptions: { url: '/test' },
      } as any

      const mockReply = {
        header: jest.fn(),
      } as any

      // Mock services
      const cognitoService = claimsMiddleware['cognitoService']
      const prismaService = tenantMiddleware['prisma']

      jest.spyOn(cognitoService, 'validateToken').mockResolvedValue({
        sub: 'test-user',
        org_id: 'test-org',
        role: 'DOCTOR',
        email: 'test@example.com',
        email_verified: true,
        purpose_of_use: 'TREATMENT',
        groups: ['DOCTOR'],
        mfa_enabled: false,
        last_login_at: new Date().toISOString(),
      })

      jest.spyOn(prismaService.organization, 'findUnique').mockResolvedValue({
        id: 'test-org',
        name: 'Test Organization',
        type: 'PROVIDER',
        npi: null,
        address: null,
        contactInfo: null,
        settings: null,
        compliance: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      // Execute middleware chain
      let nextCalled = false
      const mockNext = jest.fn(() => {
        nextCalled = true
      })

      // 1. Claims middleware
      await claimsMiddleware.use(mockRequest, mockReply, async (err) => {
        if (err) throw err

        // 2. Tenant middleware
        await tenantMiddleware.use(mockRequest, mockReply, async (err) => {
          if (err) throw err

          // 3. Rate limit middleware
          await rateLimitMiddleware.use(mockRequest, mockReply, mockNext)
        })
      })

      expect(nextCalled).toBe(true)
      expect((mockRequest as any).claims).toBeDefined()
      expect((mockRequest as any).tenant).toBeDefined()

      // Should have set appropriate headers
      expect(mockReply.header).toHaveBeenCalledWith('X-Tenant-ID', 'test-org')
      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10')
      expect(mockReply.header).toHaveBeenCalledWith('X-RateLimit-Remaining', '9')
    })

    it('should handle errors in middleware chain', async () => {
      const mockRequest = {
        headers: { authorization: 'Bearer invalid-token' },
        ip: '127.0.0.1',
        method: 'GET',
        routeOptions: { url: '/test' },
      } as any

      const mockReply = {
        header: jest.fn(),
      } as any

      // Mock CognitoService to throw error
      const cognitoService = claimsMiddleware['cognitoService']
      jest.spyOn(cognitoService, 'validateToken').mockRejectedValue(new Error('Invalid token'))

      let errorThrown = false
      try {
        await claimsMiddleware.use(mockRequest, mockReply, jest.fn())
      } catch (error: any) {
        errorThrown = true
        expect(error.message).toContain('Invalid token')
      }

      expect(errorThrown).toBe(true)
    })
  })
})
