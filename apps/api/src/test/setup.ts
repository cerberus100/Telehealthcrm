/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { MockPrismaService } from '../mock-prisma.service';
import { CognitoService } from '../auth/cognito.service';
import { SchedulingService } from '../services/scheduling.service';
import { RxPadService } from '../services/rx-pad.service';

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
// Test configuration for different environments
export const testConfig = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
  },
  cognito: {
    userPoolId: 'test-pool-id',
    clientId: 'test-client-id',
    region: 'us-east-1',
  },
  aws: {
    region: 'us-east-1',
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
  redis: {
    host: 'localhost',
    port: 6379,
  },
  opentelemetry: {
    enabled: false,
    serviceName: 'telehealth-test',
  },
  rateLimiting: {
    enabled: false,
  },
};

export const createTestingModule = async (providers: any[] = [], imports: any[] = [], useRealServices = false) => {
  const module: TestingModule = await Test.createTestingModule({
    imports,
    providers: [
      ConfigService,
      {
        provide: PrismaService,
        useClass: useRealServices ? PrismaService : MockPrismaService,
      },
      {
        provide: CognitoService,
        useFactory: (configService: ConfigService) => {
          // For tests, we'll use the real CognitoService but with demo mode
          process.env.API_DEMO_MODE = 'true';
          return new CognitoService(configService);
        },
        inject: [ConfigService],
      },
      ...(useRealServices ? [
        SchedulingService,
        RxPadService,
      ] : []),
      ...providers,
    ],
  }).compile();

  return module;
};

// Mock AWS services for testing
export const mockAWSServices = () => ({
  DynamoDB: {
    send: jest.fn(),
  },
  S3: {
    send: jest.fn(),
  },
  CloudFront: {
    send: jest.fn(),
  },
  SecretsManager: {
    send: jest.fn(),
  },
});

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
  reasonCodes: ['REASON_1', 'REASON_2'],
  createdFrom: 'WEB',
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

// New test factories for AWS services
export const createMockProviderAvailability = (overrides: any = {}) => ({
  providerId: 'provider-123',
  orgId: 'org-123',
  date: new Date().toISOString().split('T')[0],
  slots: [
    {
      id: 'slot-1',
      startTime: '09:00',
      endTime: '09:30',
      duration: 30,
      isBooked: false,
    },
    {
      id: 'slot-2',
      startTime: '10:00',
      endTime: '10:30',
      duration: 30,
      isBooked: false,
    },
  ],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockAppointmentBooking = (overrides: any = {}) => ({
  id: 'appointment-123',
  providerId: 'provider-123',
  patientId: 'patient-123',
  orgId: 'org-123',
  date: new Date().toISOString().split('T')[0],
  startTime: '09:00',
  endTime: '09:30',
  duration: 30,
  status: 'SCHEDULED',
  appointmentType: 'TELEHEALTH',
  notes: 'Regular checkup',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockRxPadTemplate = (overrides: any = {}) => ({
  id: 'template-123',
  providerId: 'provider-123',
  orgId: 'org-123',
  name: 'Standard Rx Pad',
  description: 'Default prescription template',
  s3Key: 'templates/org-123/provider-123/template-123-Standard_Rx_Pad.pdf',
  s3Url: 'https://test-bucket.s3.us-east-1.amazonaws.com/templates/org-123/provider-123/template-123-Standard_Rx_Pad.pdf',
  cloudfrontUrl: 'https://test-distribution.cloudfront.net/templates/org-123/provider-123/template-123-Standard_Rx_Pad.pdf',
  fileSize: 1024000, // 1MB
  mimeType: 'application/pdf',
  isActive: true,
  isDefault: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'user-123',
  ...overrides,
});

export const createMockRxPadUpload = (overrides: any = {}) => ({
  providerId: 'provider-123',
  orgId: 'org-123',
  name: 'Test Rx Pad',
  description: 'Test prescription template',
  file: Buffer.from('mock pdf content'),
  mimeType: 'application/pdf',
  fileSize: 1024000,
  isDefault: false,
  uploadedBy: 'user-123',
  ...overrides,
});

export const createMockTimeSlot = (overrides: any = {}) => ({
  id: 'slot-123',
  startTime: '09:00',
  endTime: '09:30',
  duration: 30,
  isBooked: false,
  bookedBy: undefined,
  appointmentId: undefined,
  notes: undefined,
  ...overrides,
});

// Enhanced mock factories with more comprehensive data
export const createMockPatient = (overrides: any = {}) => ({
  id: 'patient-123',
  orgId: 'org-123',
  tenantUid: 'patient-uid-123',
  legalName: 'John Doe',
  dob: new Date('1990-01-01T00:00:00Z'),
  phones: ['+15551234567'],
  emails: ['john@example.com'],
  address: {
    street: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zipCode: '12345',
  },
  insurancePolicyId: 'insurance-123',
  insurancePolicy: {
    id: 'insurance-123',
    payerCode: 'BCBS',
    memberIdEncrypted: Buffer.from('encrypted-member-id'),
    groupId: 'GRP123',
    planName: 'Blue Cross Blue Shield',
    coverageActive: true,
  },
  piiTokenId: 'pii-token-123',
  consults: [],
  duplicateLinks: [],
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

export const createMockLabOrder = (overrides: any = {}) => ({
  id: 'lab-order-123',
  orgId: 'org-123',
  consultId: 'consult-123',
  labOrgId: 'lab-org-456',
  tests: ['CBC', 'BMP', 'Lipid Panel'],
  status: 'SUBMITTED',
  shipments: [],
  results: [],
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

export const createMockLabResult = (overrides: any = {}) => ({
  id: 'lab-result-123',
  orgId: 'org-123',
  labOrderId: 'lab-order-123',
  resultBlobEncrypted: Buffer.from('encrypted-lab-results'),
  flaggedAbnormal: false,
  releasedToProviderAt: new Date('2025-01-01T10:00:00Z'),
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

export const createMockPharmacyFulfillment = (overrides: any = {}) => ({
  id: 'fulfillment-123',
  orgId: 'org-123',
  rxId: 'rx-123',
  status: 'QUEUED',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

// Test utilities for AWS service mocking
export const mockDynamoDBResponse = (data: any) => ({
  send: jest.fn().mockResolvedValue({ Item: data }),
});

export const mockS3Response = (data: any) => ({
  send: jest.fn().mockResolvedValue(data),
});

export const mockCloudFrontResponse = (data: any) => ({
  send: jest.fn().mockResolvedValue(data),
});

// Test utilities for service testing
export const setupAWSTestEnvironment = () => {
  process.env.AWS_REGION = 'us-east-1';
  process.env.AWS_ACCESS_KEY_ID = 'test-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
  process.env.DYNAMODB_SCHEDULE_TABLE = 'test-schedule-table';
  process.env.S3_RX_PAD_BUCKET = 'test-rx-pad-bucket';
  process.env.CLOUDFRONT_DISTRIBUTION_ID = 'test-distribution-id';
  process.env.API_DEMO_MODE = 'true';
};

export const cleanupAWSTestEnvironment = () => {
  delete process.env.AWS_REGION;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.DYNAMODB_SCHEDULE_TABLE;
  delete process.env.S3_RX_PAD_BUCKET;
  delete process.env.CLOUDFRONT_DISTRIBUTION_ID;
};