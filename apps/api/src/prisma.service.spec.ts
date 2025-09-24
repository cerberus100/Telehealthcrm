import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService, TenantContext } from './prisma.service'
import { ConfigService } from '@nestjs/config'
import { MockPrismaService } from './mock-prisma.service'

describe('PrismaService', () => {
  let service: PrismaService
  let mockPrismaService: MockPrismaService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                'API_DEMO_MODE': 'true', // Enable demo mode for testing
                'DATABASE_URL': 'test://localhost/test',
              }
              return config[key as keyof typeof config]
            }),
          },
        },
      ],
    }).compile()

    service = module.get<PrismaService>(PrismaService)
    mockPrismaService = new MockPrismaService()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('Demo Mode', () => {
    it('should initialize in demo mode correctly', () => {
      expect(service.isDemoMode()).toBe(true)
      expect(service['demoMode']).toBe(true)
    })

    it('should return mock tenant context in demo mode', async () => {
      const tenantContext = await service.getTenantContext('mock-org-123')

      expect(tenantContext).toBeDefined()
      expect(tenantContext?.orgId).toBe('mock-org-123')
      expect(tenantContext?.orgType).toBe('PROVIDER')
      expect(tenantContext?.orgName).toBe('Demo Organization')
      expect(tenantContext?.isActive).toBe(true)
    })

    it('should return null for unknown org in demo mode', async () => {
      const tenantContext = await service.getTenantContext('unknown-org')

      expect(tenantContext).toBeNull()
    })

    it('should validate known org in demo mode', async () => {
      const isValid = await service.validateOrganization('mock-org-123')

      expect(isValid).toBe(true)
    })

    it('should return false for unknown org in demo mode', async () => {
      const isValid = await service.validateOrganization('unknown-org')

      expect(isValid).toBe(false)
    })
  })

  describe('Tenant Context Operations', () => {
    it('should execute operation with tenant context', async () => {
      const result = await service.executeWithTenant('mock-org-123', async (tenantContext: TenantContext) => {
        return {
          orgId: tenantContext.orgId,
          orgType: tenantContext.orgType,
          operation: 'test-operation',
        }
      })

      expect(result).toBeDefined()
      expect(result.orgId).toBe('mock-org-123')
      expect(result.orgType).toBe('PROVIDER')
      expect(result.operation).toBe('test-operation')
    })

    it('should throw error for invalid org', async () => {
      await expect(
        service.executeWithTenant('invalid-org', async () => 'test')
      ).rejects.toThrow('Tenant context not found')
    })
  })

  describe('User Operations', () => {
    it('should get user with org context in demo mode', async () => {
      const user = await service.getUserWithOrg('user_123')

      expect(user).toBeDefined()
      expect(user?.id).toBe('user_123')
      expect(user?.role).toBe('DOCTOR')
      expect(user?.orgId).toBe('org_123')
    })

    it('should handle cross-org access in demo mode', async () => {
      // In demo mode, the mock service returns the same user regardless of orgId
      // This is expected behavior for the mock service
      const user = await service.getUserWithOrg('user_123', 'different-org-123')

      expect(user).toBeDefined()
      expect(user?.id).toBe('user_123')
      expect(user?.orgId).toBe('org_123') // Mock service always returns the same org
    })
  })

  describe('Organization-Scoped Queries', () => {
    it('should return mock service for demo mode', () => {
      const scopedQuery = service.getOrgScopedQuery('mock-org-123', 'consult')

      // Check that the returned object has the same methods as the mock service
      expect(scopedQuery).toHaveProperty('findMany')
      expect(scopedQuery).toHaveProperty('findUnique')
      expect(scopedQuery).toHaveProperty('count')
      expect(scopedQuery).toHaveProperty('update')
    })

    it('should return prisma entity for production mode', () => {
      // Mock production mode by accessing the private property
      Object.defineProperty(service, 'demoMode', { value: false, writable: true })

      const scopedQuery = service.getOrgScopedQuery('org-123', 'consult')

      expect(scopedQuery).toBe(service.consult)
    })
  })

  describe('Production Mode', () => {
    beforeEach(() => {
      // Mock production mode
      Object.defineProperty(service, 'demoMode', { value: false, writable: true })
    })

    it('should initialize in production mode correctly', () => {
      expect(service.isDemoMode()).toBe(false)
    })

    it('should handle production mode operations', async () => {
      // Mock production database operations
      const mockTenantContext: TenantContext = {
        orgId: 'prod-org-123',
        orgType: 'PROVIDER',
        orgName: 'Production Organization',
        isActive: true,
      }

      // These would normally connect to real database
      // For testing, we just verify the method exists and is callable
      expect(service.onModuleInit).toBeDefined()
      expect(service.onModuleDestroy).toBeDefined()
      expect(service.getTenantContext).toBeDefined()
      expect(service.validateOrganization).toBeDefined()
    })
  })
})
