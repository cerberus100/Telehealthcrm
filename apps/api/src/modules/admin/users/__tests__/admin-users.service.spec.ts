/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminUsersService } from '../admin-users.service';
import { CognitoService } from '../../../../auth/cognito.service';
import { PrismaService } from '../../../../prisma.service';
import { 
  createTestingModule, 
  mockClaims,
  createMockUser,
  createMockOrganization 
} from '../../../../test/setup';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let cognitoService: CognitoService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModule([
      AdminUsersService,
      CognitoService,
    ]);

    service = module.get<AdminUsersService>(AdminUsersService);
    cognitoService = module.get<CognitoService>(CognitoService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should return paginated users for admin', async () => {
      const mockUsers = [createMockUser()];
      const claims = mockClaims({ role: 'ADMIN' });

      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue(mockUsers);
      jest.spyOn(prismaService.user, 'count').mockResolvedValue(1);

      const result = await service.getUsers(
        { cursor: undefined, limit: 50 }, 
        claims
      );

      expect(result).toEqual({
        items: mockUsers.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          purposeOfUse: user.purposeOfUse,
          phoneNumber: user.phoneNumber,
          department: user.department,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt?.toISOString(),
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        })),
        next_cursor: null,
      });
    });

    it('should throw error for non-admin users', async () => {
      const claims = mockClaims({ role: 'DOCTOR' });

      await expect(service.getUsers({ cursor: undefined, limit: 50 }, claims)).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('getUser', () => {
    it('should return user by ID', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'doctor@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'DOCTOR',
        purposeOfUse: 'TREATMENT',
        phoneNumber: '+1234567890',
        department: 'Cardiology',
        isActive: true,
        lastLoginAt: new Date('2025-01-01T00:00:00Z'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      });
      const claims = mockClaims({ role: 'ADMIN' });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.getUser('user-123', claims);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        purposeOfUse: mockUser.purposeOfUse,
        phoneNumber: mockUser.phoneNumber,
        department: mockUser.department,
        isActive: mockUser.isActive,
        lastLoginAt: mockUser.lastLoginAt?.toISOString(),
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });
  });

  describe('createUser', () => {
    it('should create new user', async () => {
      const userData = {
        email: 'newuser@test.com',
        role: 'DOCTOR' as const,
        firstName: 'John',
        lastName: 'Doe',
        orgId: 'org-123',
        isActive: true,
      };
      const claims = mockClaims({ role: 'ADMIN' });
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'newuser@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'DOCTOR',
        purposeOfUse: 'TREATMENT',
        phoneNumber: '+1234567890',
        department: 'Cardiology',
        isActive: true,
        lastLoginAt: new Date('2025-01-01T00:00:00Z'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      });

      jest.spyOn(prismaService.user, 'findFirst').mockResolvedValue(null);
      jest.spyOn(cognitoService, 'createUser').mockResolvedValue(mockUser);
      jest.spyOn(prismaService.user, 'create').mockResolvedValue(mockUser);

      const result = await service.createUser(userData, claims);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        purposeOfUse: mockUser.purposeOfUse,
        phoneNumber: mockUser.phoneNumber,
        department: mockUser.department,
        isActive: mockUser.isActive,
        lastLoginAt: mockUser.lastLoginAt?.toISOString(),
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      expect(cognitoService.createUser).toHaveBeenCalledWith(userData);
    });
  });

  describe('updateUser', () => {
    it('should update user', async () => {
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'DOCTOR' as const,
      };
      const claims = mockClaims({ role: 'ADMIN' });
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'doctor@test.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'DOCTOR',
        purposeOfUse: 'TREATMENT',
        phoneNumber: '+1234567890',
        department: 'Cardiology',
        isActive: true,
        lastLoginAt: new Date('2025-01-01T00:00:00Z'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(createMockUser());
      jest.spyOn(cognitoService, 'updateUser').mockResolvedValue(mockUser);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser);

      const result = await service.updateUser('user-123', updateData, claims);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        purposeOfUse: mockUser.purposeOfUse,
        phoneNumber: mockUser.phoneNumber,
        department: mockUser.department,
        isActive: mockUser.isActive,
        lastLoginAt: mockUser.lastLoginAt?.toISOString(),
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      expect(cognitoService.updateUser).toHaveBeenCalledWith('user-123', updateData);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user', async () => {
      const claims = mockClaims({ role: 'ADMIN' });
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'doctor@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'DOCTOR',
        purposeOfUse: 'TREATMENT',
        phoneNumber: '+1234567890',
        department: 'Cardiology',
        isActive: false,
        lastLoginAt: new Date('2025-01-01T00:00:00Z'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(createMockUser());
      jest.spyOn(cognitoService, 'deactivateUser').mockResolvedValue(undefined);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser);

      const result = await service.deactivateUser('user-123', claims);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        purposeOfUse: mockUser.purposeOfUse,
        phoneNumber: mockUser.phoneNumber,
        department: mockUser.department,
        isActive: mockUser.isActive,
        lastLoginAt: mockUser.lastLoginAt?.toISOString(),
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      expect(cognitoService.deactivateUser).toHaveBeenCalledWith('user-123');
    });
  });

  describe('activateUser', () => {
    it('should activate user', async () => {
      const claims = mockClaims({ role: 'ADMIN' });
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'doctor@test.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'DOCTOR',
        purposeOfUse: 'TREATMENT',
        phoneNumber: '+1234567890',
        department: 'Cardiology',
        isActive: true,
        lastLoginAt: new Date('2025-01-01T00:00:00Z'),
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(createMockUser({ isActive: false }));
      jest.spyOn(cognitoService, 'activateUser').mockResolvedValue(undefined);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser);

      const result = await service.activateUser('user-123', claims);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        purposeOfUse: mockUser.purposeOfUse,
        phoneNumber: mockUser.phoneNumber,
        department: mockUser.department,
        isActive: mockUser.isActive,
        lastLoginAt: mockUser.lastLoginAt?.toISOString(),
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      expect(cognitoService.activateUser).toHaveBeenCalledWith('user-123');
    });
  });

  describe('changeUserPassword', () => {
    it('should change user password', async () => {
      const passwordData = {
        newPassword: 'newpassword123',
        temporaryPassword: true,
      };
      const claims = mockClaims({ role: 'ADMIN' });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(createMockUser());
      jest.spyOn(cognitoService, 'changeUserPassword').mockResolvedValue({ message: 'Password changed successfully', temporaryPassword: true });

      const result = await service.changeUserPassword('user-123', passwordData, claims);

      expect(result).toEqual({ message: 'Password changed successfully', temporaryPassword: true });
      expect(cognitoService.changeUserPassword).toHaveBeenCalledWith('user-123', passwordData);
    });
  });

  describe('resendInvitation', () => {
    it('should resend invitation', async () => {
      const claims = mockClaims({ role: 'ADMIN' });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(createMockUser());
      jest.spyOn(cognitoService, 'resendInvitation').mockResolvedValue({ email: 'dr@example.com', message: 'Invitation resent successfully' });

      const result = await service.resendInvitation('user-123', claims);

      expect(result).toEqual({ email: 'dr@example.com', message: 'Invitation resent successfully' });
      expect(cognitoService.resendInvitation).toHaveBeenCalledWith('user-123');
    });
  });
});