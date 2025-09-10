/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { MockPrismaService } from '../mock-prisma.service';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.API_DEMO_MODE = 'true';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
});

afterAll(async () => {
  // Cleanup after all tests
});

// Test utilities
export const createTestingModule = async (providers: any[] = [], imports: any[] = []) => {
  const module: TestingModule = await Test.createTestingModule({
    imports,
    providers: [
      ConfigService,
      {
        provide: PrismaService,
        useClass: MockPrismaService,
      },
      ...providers,
    ],
  }).compile();

  return module;
};

export const mockRequest = (overrides: any = {}) => ({
  headers: {
    authorization: 'Bearer mock_token',
    'correlation-id': 'test-correlation-id',
    ...overrides.headers,
  },
  ip: '127.0.0.1',
  method: 'GET',
  url: '/test',
  body: {},
  query: {},
  params: {},
  claims: {
    sub: 'test-user-id',
    role: 'DOCTOR',
    orgId: 'test-org-id',
    purposeOfUse: 'TREATMENT',
  },
  tenant: {
    orgId: 'test-org-id',
    orgType: 'PROVIDER',
    orgName: 'Test Clinic',
    isActive: true,
    compliance: {
      hipaaCompliant: true,
      baaSigned: true,
    },
  },
  ...overrides,
});

export const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.getHeader = jest.fn().mockReturnValue(undefined);
  return res;
};

export const mockClaims = (overrides: any = {}) => ({
  sub: 'test-user-id',
  role: 'DOCTOR',
  orgId: 'test-org-id',
  purposeOfUse: 'TREATMENT',
  ...overrides,
});

export const mockTenantContext = (overrides: any = {}) => ({
  orgId: 'test-org-id',
  orgType: 'PROVIDER',
  orgName: 'Test Clinic',
  isActive: true,
  compliance: {
    hipaaCompliant: true,
    baaSigned: true,
  },
  ...overrides,
});

// Mock data factories
export const createMockConsult = (overrides: any = {}) => ({
  id: 'consult-123',
  status: 'PASSED',
  patientId: 'patient-123',
  providerOrgId: 'test-org-id',
  orgId: 'test-org-id',
  patient: {
    id: 'patient-123',
    legalName: 'John Doe',
    dob: new Date('1990-01-01T00:00:00Z'),
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'CA',
      zipCode: '12345',
    },
  },
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

export const createMockShipment = (overrides: any = {}) => ({
  id: 'shipment-123',
  trackingNumber: '1Z999AA1234567890',
  carrier: 'UPS',
  status: 'IN_TRANSIT',
  consultId: 'consult-123',
  labOrderId: 'lab-order-123',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

export const createMockRx = (overrides: any = {}) => ({
  id: 'rx-123',
  status: 'SUBMITTED',
  patientId: 'patient-123',
  providerOrgId: 'org-123',
  pharmacyOrgId: 'pharmacy-123',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

export const createMockNotification = (overrides: any = {}) => ({
  id: 'notification-123',
  type: 'CONSULT_STATUS_CHANGE',
  orgId: 'org-123',
  targetUserId: 'user-123',
  payload: { consultId: 'consult-123', status: 'PASSED' },
  status: 'PENDING',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

export const createMockUser = (overrides: any = {}) => ({
  id: 'user-123',
  email: 'doctor@test.com',
  role: 'DOCTOR',
  orgId: 'org-123',
  isActive: true,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  org: {
    id: 'org-123',
    name: 'Test Clinic',
    type: 'PROVIDER',
  },
  ...overrides,
});

export const createMockOrganization = (overrides: any = {}) => ({
  id: 'org-123',
  name: 'Test Clinic',
  type: 'PROVIDER',
  status: 'ACTIVE',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});