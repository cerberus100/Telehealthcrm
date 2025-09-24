/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConsultsService } from '../consults.service';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../audit/audit.service';
import { Logger } from '@nestjs/common';
import {
  createTestingModule,
  mockClaims,
  createMockConsult,
  createMockPatient,
  createMockOrganization,
  setupAWSTestEnvironment,
  cleanupAWSTestEnvironment
} from '../../test/setup';

describe('ConsultsService', () => {
  let service: ConsultsService;
  let prismaService: PrismaService;
  let auditService: AuditService;

  beforeAll(() => {
    setupAWSTestEnvironment();
  });

  afterAll(() => {
    cleanupAWSTestEnvironment();
  });

  beforeEach(async () => {
    const module: TestingModule = await createTestingModule([
      ConsultsService,
      AuditService,
    ]);

    service = module.get<ConsultsService>(ConsultsService);
    prismaService = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConsults', () => {
    it('should return paginated consults with enhanced mock data', async () => {
      const mockConsult = createMockConsult({
        reasonCodes: ['ICD10_A01', 'ICD10_B02'],
        createdFrom: 'WEB',
        providerOrgId: 'provider-org-123'
      });
      const mockPatient = createMockPatient({
        legalName: 'Jane Smith',
        dob: new Date('1985-05-15T00:00:00Z'),
        phones: ['+15559876543'],
        emails: ['jane.smith@example.com']
      });
      const mockOrganization = createMockOrganization({
        name: 'Advanced Medical Center',
        type: 'PROVIDER'
      });

      const mockConsults = [{
        ...mockConsult,
        patient: mockPatient,
        org: mockOrganization
      }];

      const claims = mockClaims({
        orgId: 'test-org-id',
        role: 'DOCTOR'
      });

      jest.spyOn(prismaService.consult, 'findMany').mockResolvedValue(mockConsults);
      jest.spyOn(prismaService.consult, 'count').mockResolvedValue(1);

      const result = await service.getConsults(
        { status: 'PASSED', cursor: undefined, limit: 50 },
        claims
      );

      expect(result).toEqual({
        items: mockConsults.map(c => ({
          id: c.id,
          status: c.status,
          created_at: c.createdAt.toISOString(),
          provider_org_id: c.providerOrgId,
          reason_codes: c.reasonCodes,
          created_from: c.createdFrom,
        })),
        next_cursor: undefined,
      });

      expect(prismaService.consult.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'test-org-id',
          status: 'PASSED',
        },
        take: 51, // limit + 1 for pagination
        cursor: undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: true,
          org: true,
        },
      });
    });

    it('should handle cursor-based pagination', async () => {
      const claims = mockClaims();
      const cursorId = 'consult-456';

      jest.spyOn(prismaService.consult, 'findMany').mockResolvedValue([]);
      jest.spyOn(prismaService.consult, 'count').mockResolvedValue(0);

      const result = await service.getConsults(
        { cursor: cursorId, limit: 20 },
        claims
      );

      expect(result).toEqual({
        items: [],
        next_cursor: undefined,
      });

      expect(prismaService.consult.findMany).toHaveBeenCalledWith({
        where: { orgId: 'test-org-id' },
        take: 21, // limit + 1 for pagination
        skip: 1, // cursor pagination
        cursor: { id: cursorId },
        orderBy: { createdAt: 'desc' },
        include: {
          patient: true,
          org: true,
        },
      });
    });

    it('should filter by consult status', async () => {
      const claims = mockClaims();
      const mockConsults = [createMockConsult({ status: 'FAILED' })];

      jest.spyOn(prismaService.consult, 'findMany').mockResolvedValue(mockConsults);
      jest.spyOn(prismaService.consult, 'count').mockResolvedValue(1);

      await service.getConsults(
        { status: 'FAILED', limit: 10 },
        claims
      );

      expect(prismaService.consult.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 'test-org-id',
          status: 'FAILED',
        },
        take: 11, // limit + 1 for pagination
        orderBy: { createdAt: 'desc' },
        include: {
          patient: true,
          org: true,
        },
      });
    });
  });

  describe('getConsult', () => {
    it('should return consult by ID', async () => {
      const mockConsult = createMockConsult({ providerOrgId: 'test-org-id' });
      const claims = mockClaims();

      jest.spyOn(prismaService.consult, 'findUnique').mockResolvedValue(mockConsult);

      const result = await service.getConsult('consult-123', claims);

      expect(result).toEqual({
        id: mockConsult.id,
        status: mockConsult.status,
        patient: {
          id: mockConsult.patient.id,
          legal_name: mockConsult.patient.legalName,
          dob: mockConsult.patient.dob.toISOString(),
          address: mockConsult.patient.address,
        },
        provider_org_id: mockConsult.providerOrgId,
        created_at: mockConsult.createdAt.toISOString(),
        reason_codes: mockConsult.reasonCodes,
        created_from: mockConsult.createdFrom,
      });
      expect(prismaService.consult.findUnique).toHaveBeenCalledWith({
        where: { id: 'consult-123' },
        include: {
          org: true,
          patient: true,
        },
      });
    });

    it('should throw error for non-existent consult', async () => {
      const claims = mockClaims();

      jest.spyOn(prismaService.consult, 'findUnique').mockResolvedValue(null);

      await expect(service.getConsult('nonexistent', claims)).rejects.toThrow('Consult not found');
    });
  });

  describe('updateConsultStatus', () => {
    it('should update consult status', async () => {
      const mockConsult = createMockConsult({ status: 'APPROVED' });
      const claims = mockClaims();

      jest.spyOn(prismaService.consult, 'findUnique').mockResolvedValue(createMockConsult({ providerOrgId: 'test-org-id' }));
      jest.spyOn(prismaService.consult, 'update').mockResolvedValue(mockConsult);
      jest.spyOn(auditService, 'logActivity').mockResolvedValue(undefined);

      const result = await service.updateConsultStatus('consult-123', { status: 'APPROVED' }, claims);

      expect(result).toEqual({
        id: mockConsult.id,
        status: 'APPROVED',
      });
      expect(prismaService.consult.update).toHaveBeenCalledWith({
        where: { id: 'consult-123' },
        data: { status: 'APPROVED' },
      });
    });

    it('should throw error for non-existent consult', async () => {
      const claims = mockClaims();

      jest.spyOn(prismaService.consult, 'findUnique').mockResolvedValue(null);

      await expect(service.updateConsultStatus('nonexistent', { status: 'APPROVED' }, claims)).rejects.toThrow('Consult not found');
    });

    it('should throw error for invalid status', async () => {
      const claims = mockClaims();

      jest.spyOn(prismaService.consult, 'findUnique').mockResolvedValue(createMockConsult({ providerOrgId: 'test-org-id' }));
      jest.spyOn(prismaService.consult, 'update').mockRejectedValue(new Error('Invalid status'));

      await expect(service.updateConsultStatus('consult-123', { status: 'INVALID_STATUS' as any }, claims)).rejects.toThrow('Invalid status');
    });
  });
});