import { Test, TestingModule } from '@nestjs/testing'
import { UnauthorizedException } from '@nestjs/common'
import { ClaimsMiddleware } from './claims.middleware'
import { CognitoService } from '../auth/cognito.service'

describe('ClaimsMiddleware', () => {
  let middleware: ClaimsMiddleware
  let cognitoService: CognitoService

  const mockCognitoService = {
    validateToken: jest.fn(),
  }

  const mockRequest = {
    headers: {} as any,
    method: 'GET',
    routeOptions: { url: '/test' },
  }

  const mockResponse = {}
  const mockNext = jest.fn()

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsMiddleware,
        {
          provide: CognitoService,
          useValue: mockCognitoService,
        },
      ],
    }).compile()

    middleware = module.get<ClaimsMiddleware>(ClaimsMiddleware)
    cognitoService = module.get<CognitoService>(CognitoService)
  })

  it('should be defined', () => {
    expect(middleware).toBeDefined()
  })

  describe('with valid JWT token', () => {
    it('should validate token and set claims', async () => {
      const token = 'valid.jwt.token'
      const mockUser = {
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

      mockRequest.headers = { authorization: `Bearer ${token}` }
      mockCognitoService.validateToken.mockResolvedValue(mockUser)

      await middleware.use(mockRequest as any, mockResponse as any, mockNext)

      expect(mockCognitoService.validateToken).toHaveBeenCalledWith(token)
      expect((mockRequest as any).claims).toEqual({
        orgId: 'org123',
        role: 'DOCTOR',
        purposeOfUse: 'TREATMENT',
        sub: 'user123',
      })
      expect((mockRequest as any).user).toEqual(mockUser)
      expect(mockRequest.headers['x-rls-org-id']).toBe('org123')
      expect(mockRequest.headers['x-rls-purpose']).toBe('TREATMENT')
      expect(mockRequest.headers['x-rls-role']).toBe('DOCTOR')
      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('with invalid JWT token', () => {
    it('should throw UnauthorizedException', async () => {
      const token = 'invalid.jwt.token'
      mockRequest.headers = { authorization: `Bearer ${token}` }
      mockCognitoService.validateToken.mockRejectedValue(new UnauthorizedException('Invalid token'))

      await expect(
        middleware.use(mockRequest as any, mockResponse as any, mockNext)
      ).rejects.toThrow('Invalid token')

      expect(mockCognitoService.validateToken).toHaveBeenCalledWith(token)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('without authorization header', () => {
    describe('for protected routes', () => {
      it('should throw UnauthorizedException', async () => {
        mockRequest.routeOptions.url = '/protected/route'

        await expect(
          middleware.use(mockRequest as any, mockResponse as any, mockNext)
        ).rejects.toThrow('Authorization header required')

        expect(mockNext).not.toHaveBeenCalled()
      })
    })

    describe('for public routes in development', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development'
        mockRequest.routeOptions.url = '/auth/login'
      })

      afterEach(() => {
        delete process.env.NODE_ENV
      })

      it('should allow access with default claims', async () => {
        await middleware.use(mockRequest as any, mockResponse as any, mockNext)

        expect((mockRequest as any).claims).toEqual({
          orgId: 'demo-org',
          role: 'SUPPORT',
          purposeOfUse: undefined,
          sub: 'anonymous',
        })
        expect(mockRequest.headers['x-rls-org-id']).toBe('demo-org')
        expect(mockNext).toHaveBeenCalled()
      })
    })

    describe('for public routes in production', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production'
        mockRequest.routeOptions.url = '/health'
      })

      afterEach(() => {
        delete process.env.NODE_ENV
      })

      it('should throw UnauthorizedException', async () => {
        await expect(
          middleware.use(mockRequest as any, mockResponse as any, mockNext)
        ).rejects.toThrow('Authorization header required')

        expect(mockNext).not.toHaveBeenCalled()
      })
    })
  })

  describe('with malformed authorization header', () => {
    it('should throw UnauthorizedException', async () => {
      mockRequest.headers = { authorization: 'InvalidHeader' }

      await expect(
        middleware.use(mockRequest as any, mockResponse as any, mockNext)
      ).rejects.toThrow('Authorization header required')

      expect(mockNext).not.toHaveBeenCalled()
    })
  })
})
