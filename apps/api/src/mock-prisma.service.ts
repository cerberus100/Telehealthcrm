import { Injectable } from '@nestjs/common'

// Mock Prisma service for testing without database connection
@Injectable()
export class MockPrismaService {
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
    update: async (params: any) => {
      return {
        id: 'user_123',
        email: 'dr@example.com',
        role: 'DOCTOR',
        orgId: 'org_123',
        lastLoginAt: new Date(),
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
  }
}
