/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConsultsService } from '../consults.service';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../audit/audit.service';
import { 
  createTestingModule, 
  mockClaims,
  createMockConsult 
} from '../../test/setup';

describe('ConsultsService', () => {
  let service: ConsultsService;
  let prismaService: PrismaService;
  let auditService: AuditService;

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
    it('should return paginated consults', async () => {
      const mockConsults = [createMockConsult()];
      const claims = mockClaims();

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
        })),
        next_cursor: null,
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
        updated_at: mockConsult.updatedAt.toISOString(),
      });
      expect(prismaService.consult.findUnique).toHaveBeenCalledWith({
        where: { id: 'consult-123' },
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