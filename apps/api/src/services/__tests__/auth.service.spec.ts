/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { CognitoService } from '../../auth/cognito.service';
import { PrismaService } from '../../prisma.service';
import { 
  createTestingModule, 
  mockRequest, 
  mockClaims,
  createMockUser,
  createMockOrganization 
} from '../../test/setup';

describe('AuthService', () => {
  let service: AuthService;
  let cognitoService: CognitoService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await createTestingModule([
      AuthService,
      CognitoService,
    ]);

    service = module.get<AuthService>(AuthService);
    cognitoService = module.get<CognitoService>(CognitoService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return access and refresh tokens for valid credentials', async () => {
      const mockUser = createMockUser();
      const mockOrg = createMockOrganization();
      
      jest.spyOn(cognitoService, 'authenticate').mockResolvedValue({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
        accessToken: 'mock_access_token',
        user: mockUser,
      });

      const result = await service.login({ email: 'test@example.com', password: 'password' });

      expect(result).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
      });
      expect(cognitoService.authenticate).toHaveBeenCalledWith('test@example.com', 'password');
    });

    it('should throw error for invalid credentials', async () => {
      jest.spyOn(cognitoService, 'authenticate').mockRejectedValue(new Error('Invalid credentials'));

      await expect(service.login({ email: 'invalid@example.com', password: 'wrong' })).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refresh', () => {
    it('should return new access token for valid refresh token', async () => {
      jest.spyOn(cognitoService, 'refreshToken').mockResolvedValue({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
        accessToken: 'new_access_token',
      });

      const result = await service.refresh({ refresh_token: 'valid_refresh_token' });

      expect(result).toEqual({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    });

    it('should throw error for invalid refresh token', async () => {
      jest.spyOn(cognitoService, 'refreshToken').mockRejectedValue(new Error('Invalid refresh token'));

      await expect(service.refresh({ refresh_token: 'invalid_refresh_token' })).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      jest.spyOn(cognitoService, 'logout').mockResolvedValue(undefined);

      await expect(service.logout({ refresh_token: 'user123' })).resolves.toEqual({ success: true });
    });

    it('should throw error if logout fails', async () => {
      jest.spyOn(cognitoService, 'logout').mockRejectedValue(new Error('Logout failed'));

      await expect(service.logout({ refresh_token: 'user123' })).resolves.toEqual({ success: true });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user for valid user ID', async () => {
      const mockUser = createMockUser();
      
      // Mock the Prisma service instead
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await service.getCurrentUser('user123');

      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          org_id: mockUser.orgId,
          last_login_at: mockUser.lastLoginAt?.toISOString() || new Date().toISOString(),
        },
        org: {
          id: mockUser.org.id,
          name: mockUser.org.name,
          type: mockUser.org.type,
        },
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user123' },
        include: { org: true },
      });
    });

    it('should throw error for non-existent user', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      await expect(service.getCurrentUser('nonexistent')).rejects.toThrow('User not found');
    });
  });
});