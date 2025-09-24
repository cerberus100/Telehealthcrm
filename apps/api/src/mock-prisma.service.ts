import { Injectable } from '@nestjs/common'

// Mock Prisma service for testing without database connection
@Injectable()
export class MockPrismaService {
  async executeWithTenant<T>(
    orgId: string,
    operation: (tenantContext: any) => Promise<T>
  ): Promise<T> {
    const tenantContext = {
      orgId: orgId || 'mock-org-123',
      orgType: 'PROVIDER',
      orgName: 'Mock Organization',
      isActive: true,
    }

    return operation(tenantContext)
  }

  async validateOrganization(orgId: string): Promise<boolean> {
    return orgId === 'mock-org-123' || orgId === 'demo-org-123'
  }

  async getUserWithOrg(userId: string, orgId?: string) {
    return {
      id: userId || 'user_123',
      email: 'dr@example.com',
      role: 'DOCTOR',
      orgId: orgId || 'mock-org-123',
      lastLoginAt: new Date(),
      org: {
        id: orgId || 'mock-org-123',
        type: 'PROVIDER',
        name: 'Mock Organization',
      },
    }
  }

  getOrgScopedQuery(orgId: string, entityName: string) {
    return this[entityName as keyof MockPrismaService]
  }
  user = {
    findUnique: async (params: any) => {
      // Mock user data
      return {
        id: 'user_123',
        email: 'dr@example.com',
        role: 'DOCTOR',
        orgId: 'org_123',
        lastLoginAt: new Date(),
        org: {
          id: 'org_123',
          type: 'PROVIDER',
          name: 'Acme Clinic',
        },
      }
    },
    findFirst: async (params: any) => {
      return {
        id: 'user_123',
        email: 'dr@example.com',
        role: 'DOCTOR',
        orgId: 'org_123',
        lastLoginAt: new Date(),
        org: {
          id: 'org_123',
          type: 'PROVIDER',
          name: 'Acme Clinic',
        },
      }
    },
    findMany: async (params: any) => {
      return [
        {
          id: 'user_123',
          email: 'dr@example.com',
          role: 'DOCTOR',
          orgId: 'org_123',
          lastLoginAt: new Date(),
        },
      ]
    },
    count: async (params: any) => {
      return 1
    },
    create: async (params: any) => {
      return {
        id: 'user_new',
        email: params.data.email,
        role: params.data.role,
        orgId: params.data.orgId,
        lastLoginAt: new Date(),
      }
    },
    update: async (params: any) => {
      // Handle user updates for demo mode
      if (params.where.id === 'mock-user-123' || params.where.id === 'demo-user-123' || params.where.id === 'user_123') {
        return {
          id: params.where.id,
          email: 'demo@example.com',
          role: 'ADMIN',
          orgId: 'mock-org-123',
          lastLoginAt: new Date(),
        }
      }
      return {
        id: 'user_123',
        email: 'dr@example.com',
        role: 'DOCTOR',
        orgId: 'org_123',
        lastLoginAt: new Date(),
      }
    },
  }

  organization = {
    findUnique: async (params: any) => {
      if (params.where.id === 'mock-org-123' || params.where.id === 'demo-org-123') {
        return {
          id: 'mock-org-123',
          type: 'PROVIDER',
          name: 'Demo Clinic',
        }
      }
      return {
        id: 'org_123',
        type: 'PROVIDER',
        name: 'Acme Clinic',
      }
    },
  }

  consult = {
    findMany: async (params: any) => {
      return [
        {
          id: 'c_123',
          status: 'PASSED',
          createdAt: new Date(),
          providerOrgId: 'org_p1',
          patient: {
            id: 'p_123',
            legalName: 'John Doe',
            dob: new Date('1990-01-01'),
            address: { city: 'Austin', state: 'TX' },
          },
          reasonCodes: ['ICD10_A01'],
          createdFrom: 'WEB',
        },
      ]
    },
    count: async (params: any) => {
      return 1
    },
    findUnique: async (params: any) => {
      return {
        id: 'c_123',
        status: 'PASSED',
        createdAt: new Date(),
        providerOrgId: 'org_p1',
        orgId: 'org_123',
        patient: {
          id: 'p_123',
          legalName: 'John Doe',
          dob: new Date('1990-01-01'),
          address: { city: 'Austin', state: 'TX' },
        },
        reasonCodes: ['ICD10_A01'],
        createdFrom: 'WEB',
      }
    },
    update: async (params: any) => {
      return {
        id: 'c_123',
        status: params.data.status,
      }
    },
  }

  shipment = {
    findMany: async (params: any) => {
      return [
        {
          id: 'sh_1',
          labOrderId: 'lo_1',
          carrier: 'UPS',
          trackingNumber: '1Z999AA1234567890',
          status: 'IN_TRANSIT',
          lastEventAt: new Date(),
          shipTo: {
            name: 'John D',
            city: 'Austin',
            state: 'TX',
            zip: '78701',
          },
        },
      ]
    },
  }

  rx = {
    findMany: async (params: any) => {
      return [
        {
          id: 'rx_123',
          status: 'SUBMITTED',
          createdAt: new Date(),
          consultId: 'c_123',
          pharmacyOrgId: 'org_pharm',
          providerUserId: 'user_123',
          refillsAllowed: 3,
          refillsUsed: 0,
        },
      ]
    },
    findUnique: async (params: any) => {
      return {
        id: 'rx_123',
        status: 'SUBMITTED',
        createdAt: new Date(),
        consultId: 'c_123',
        pharmacyOrgId: 'org_pharm',
        orgId: 'org_123',
        providerUserId: 'user_123',
        refillsAllowed: 3,
        refillsUsed: 0,
      }
    },
  }


  notification = {
    findMany: async (params: any) => {
      return [
        {
          id: 'n_1',
          type: 'LAB_RESULT_READY',
          createdAt: new Date(),
          payload: { lab_order_id: 'lo_1' },
        },
      ]
    },
    count: async (params: any) => {
      return 1
    },
    create: async (params: any) => {
      return {
        id: 'n_new',
        type: params.data.type,
        createdAt: new Date(),
        payload: params.data.payload,
        status: 'UNREAD',
        orgId: params.data.orgId,
      }
    },
    update: async (params: any) => {
      return {
        id: params.where.id,
        type: 'LAB_RESULT_READY',
        createdAt: new Date(),
        payload: { lab_order_id: 'lo_1' },
        status: 'READ',
        orgId: 'org_123',
      }
    },
    findFirst: async (params: any) => {
      return {
        id: 'n_1',
        type: 'LAB_RESULT_READY',
        createdAt: new Date(),
        payload: { lab_order_id: 'lo_1' },
        status: 'UNREAD',
        orgId: 'org_123',
      }
    },
    groupBy: async (params: any) => {
      return [
        { type: 'CONSULT_STATUS_CHANGE', _count: { type: 2 } },
        { type: 'LAB_RESULT_READY', _count: { type: 1 } },
      ]
    },
  }
}
