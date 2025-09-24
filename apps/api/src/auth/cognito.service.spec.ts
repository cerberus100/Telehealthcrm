import { CognitoService } from './cognito.service'

describe('CognitoService', () => {
  let service: CognitoService

  beforeEach(() => {
    // Create service instance directly for testing role mapping methods
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config = {
          'API_DEMO_MODE': 'true', // Enable demo mode to skip AWS initialization
          'COGNITO_USER_POOL_ID': 'test-pool',
          'COGNITO_CLIENT_ID': 'test-client',
          'AWS_REGION': 'us-east-1',
        }
        return config[key as keyof typeof config]
      }),
    } as any

    service = new CognitoService(mockConfigService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('mapRole', () => {
    it('should map database roles to API roles correctly', () => {
      // Test direct mapping
      expect(service['mapRole']('ADMIN')).toBe('ADMIN')
      expect(service['mapRole']('DOCTOR')).toBe('DOCTOR')
      expect(service['mapRole']('LAB_TECH')).toBe('LAB_TECH')
      expect(service['mapRole']('PHARMACIST')).toBe('PHARMACIST')
      expect(service['mapRole']('MARKETER')).toBe('MARKETER')
      expect(service['mapRole']('SUPPORT')).toBe('SUPPORT')
      expect(service['mapRole']('AUDITOR')).toBe('AUDITOR')

      // Test legacy mapping
      expect(service['mapRole']('ORG_MANAGER')).toBe('ADMIN')

      // Test unknown role defaults to SUPPORT
      expect(service['mapRole']('UNKNOWN_ROLE')).toBe('SUPPORT')
      expect(service['mapRole'](undefined)).toBe('SUPPORT')
    })
  })

  describe('isSuperAdmin', () => {
    it('should correctly identify super admins', () => {
      const superAdmin = {
        role: 'SUPER_ADMIN',
        groups: [],
      } as any

      const admin = {
        role: 'ADMIN',
        groups: ['ADMIN'],
      } as any

      const regularUser = {
        role: 'DOCTOR',
        groups: [],
      } as any

      expect(service.isSuperAdmin(superAdmin)).toBe(true)
      expect(service.isSuperAdmin(admin)).toBe(true)
      expect(service.isSuperAdmin(regularUser)).toBe(false)
    })
  })

  describe('isMarketerAdmin', () => {
    it('should correctly identify marketer admins', () => {
      const marketerAdmin = {
        role: 'MARKETER_ADMIN',
        groups: [],
      } as any

      const regularMarketer = {
        role: 'MARKETER',
        groups: [],
      } as any

      expect(service.isMarketerAdmin(marketerAdmin)).toBe(true)
      expect(service.isMarketerAdmin(regularMarketer)).toBe(false)
    })
  })

  describe('hasRole', () => {
    it('should correctly check role membership', () => {
      const userWithRole = {
        role: 'DOCTOR',
        groups: ['DOCTOR'],
      } as any

      const userWithoutRole = {
        role: 'MARKETER',
        groups: ['MARKETER'],
      } as any

      expect(service.hasRole(userWithRole, 'DOCTOR')).toBe(true)
      expect(service.hasRole(userWithRole, 'ADMIN')).toBe(false)
      expect(service.hasRole(userWithoutRole, 'DOCTOR')).toBe(false)
    })
  })

  describe('hasAnyRole', () => {
    it('should correctly check multiple role membership', () => {
      const userWithRole = {
        role: 'DOCTOR',
        groups: ['DOCTOR'],
      } as any

      const userWithoutRole = {
        role: 'MARKETER',
        groups: ['MARKETER'],
      } as any

      expect(service.hasAnyRole(userWithRole, ['DOCTOR', 'ADMIN'])).toBe(true)
      expect(service.hasAnyRole(userWithRole, ['ADMIN', 'SUPER_ADMIN'])).toBe(false)
      expect(service.hasAnyRole(userWithoutRole, ['DOCTOR', 'ADMIN'])).toBe(false)
    })
  })

  describe('validatePurposeOfUse', () => {
    it('should validate purpose of use correctly', () => {
      const user = {
        purpose_of_use: 'TREATMENT',
        groups: [],
      } as any

      const userWithoutPurpose = {
        purpose_of_use: null,
        groups: [],
      } as any

      expect(service.validatePurposeOfUse(user, 'TREATMENT')).toBe(true)
      expect(service.validatePurposeOfUse(user, 'PAYMENT')).toBe(false)
      expect(service.validatePurposeOfUse(userWithoutPurpose, 'TREATMENT')).toBe(false)
    })
  })
})
