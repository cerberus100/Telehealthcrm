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
        { cursor: undefined, limit: 50, orgId: 'org-123' }, 
        claims
      );

      expect(result).toEqual({
        users: mockUsers,
        pagination: {
          hasMore: false,
          nextCursor: null,
          total: 1,
        },
      });
    });

    it('should throw error for non-admin users', async () => {
      const claims = mockClaims({ role: 'DOCTOR' });

      await expect(service.getUsers({ cursor: undefined, limit: 50 }, claims)).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('getUser', () => {
    it('should return user by ID', async () => {
      const mockUser = createMockUser();
      const claims = mockClaims({ role: 'ADMIN' });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.getUser('user-123', claims);

      expect(result).toEqual(mockUser);
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
      const mockUser = createMockUser(userData);

      jest.spyOn(cognitoService, 'createUser').mockResolvedValue(mockUser);
      jest.spyOn(prismaService.user, 'create').mockResolvedValue(mockUser);

      const result = await service.createUser(userData, claims);

      expect(result).toEqual(mockUser);
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
      const mockUser = createMockUser(updateData);

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(createMockUser());
      jest.spyOn(cognitoService, 'updateUser').mockResolvedValue(mockUser);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser);

      const result = await service.updateUser('user-123', updateData, claims);

      expect(result).toEqual(mockUser);
      expect(cognitoService.updateUser).toHaveBeenCalledWith('user-123', updateData);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user', async () => {
      const claims = mockClaims({ role: 'ADMIN' });
      const mockUser = createMockUser({ isActive: false });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(createMockUser());
      jest.spyOn(cognitoService, 'deactivateUser').mockResolvedValue(undefined);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser);

      const result = await service.deactivateUser('user-123', claims);

      expect(result).toEqual(mockUser);
      expect(cognitoService.deactivateUser).toHaveBeenCalledWith('user-123');
    });
  });

  describe('activateUser', () => {
    it('should activate user', async () => {
      const claims = mockClaims({ role: 'ADMIN' });
      const mockUser = createMockUser({ isActive: true });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(createMockUser({ isActive: false }));
      jest.spyOn(cognitoService, 'activateUser').mockResolvedValue(undefined);
      jest.spyOn(prismaService.user, 'update').mockResolvedValue(mockUser);

      const result = await service.activateUser('user-123', claims);

      expect(result).toEqual(mockUser);
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
      jest.spyOn(cognitoService, 'changeUserPassword').mockResolvedValue(undefined);

      const result = await service.changeUserPassword('user-123', passwordData, claims);

      expect(result).toBeUndefined();
      expect(cognitoService.changeUserPassword).toHaveBeenCalledWith('user-123', passwordData);
    });
  });

  describe('resendInvitation', () => {
    it('should resend invitation', async () => {
      const claims = mockClaims({ role: 'ADMIN' });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(createMockUser());
      jest.spyOn(cognitoService, 'resendInvitation').mockResolvedValue(undefined);

      const result = await service.resendInvitation('user-123', claims);

      expect(result).toBeUndefined();
      expect(cognitoService.resendInvitation).toHaveBeenCalledWith('user-123');
    });
  });
});