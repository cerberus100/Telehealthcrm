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
        accessToken: 'mock_access_token',
        refreshToken: 'mock_refresh_token',
        user: mockUser,
        organization: mockOrg,
      });

      const result = await service.login('test@example.com');

      expect(result).toEqual({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        user: mockUser,
        organization: mockOrg,
      });
      expect(cognitoService.authenticate).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw error for invalid credentials', async () => {
      jest.spyOn(cognitoService, 'authenticate').mockRejectedValue(new Error('Invalid credentials'));

      await expect(service.login('invalid@example.com')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('refresh', () => {
    it('should return new access token for valid refresh token', async () => {
      jest.spyOn(cognitoService, 'refreshToken').mockResolvedValue({
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
      });

      const result = await service.refresh({ refresh_token: 'valid_refresh_token' });

      expect(result).toEqual({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
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

      await expect(service.logout({ refresh_token: 'user123' })).resolves.toBeUndefined();
    });

    it('should throw error if logout fails', async () => {
      jest.spyOn(cognitoService, 'logout').mockRejectedValue(new Error('Logout failed'));

      await expect(service.logout({ refresh_token: 'user123' })).rejects.toThrow('Logout failed');
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user for valid user ID', async () => {
      const mockUser = createMockUser();
      
      jest.spyOn(cognitoService, 'getUserById').mockResolvedValue(mockUser);

      const result = await service.getCurrentUser('user123');

      expect(result).toEqual(mockUser);
      expect(cognitoService.getUserById).toHaveBeenCalledWith('user123');
    });

    it('should throw error for non-existent user', async () => {
      jest.spyOn(cognitoService, 'getUserById').mockRejectedValue(new Error('User not found'));

      await expect(service.getCurrentUser('nonexistent')).rejects.toThrow('User not found');
    });
  });
});