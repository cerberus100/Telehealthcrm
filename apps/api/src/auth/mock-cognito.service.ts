import { Injectable } from '@nestjs/common';
import { CognitoUser, LoginResponse, RefreshResponse } from '../auth/cognito.service';

@Injectable()
export class MockCognitoService {
  async validateToken(token: string): Promise<CognitoUser> {
    // Mock implementation for demo mode
    return {
      sub: 'mock-user-123',
      email: 'demo@example.com',
      email_verified: true,
      org_id: 'mock-org-123',
      role: 'ADMIN',
      purpose_of_use: 'TREATMENT',
      groups: ['ADMIN'],
      mfa_enabled: false,
      last_login_at: new Date().toISOString(),
    };
  }

  async authenticate(email: string, _password: string): Promise<LoginResponse> {
    // Mock implementation for demo mode (aligns with CognitoService signature)
    return {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
      accessToken: 'mock_access_token',
      user: {
        sub: 'mock-user-123',
        email,
        email_verified: true,
        org_id: 'mock-org-123',
        role: 'ADMIN',
        purpose_of_use: 'TREATMENT',
        groups: ['ADMIN'],
        mfa_enabled: false,
        last_login_at: new Date().toISOString(),
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    // Mock implementation for demo mode
    return {
      access_token: 'new_mock_access_token',
      refresh_token: 'new_mock_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
    };
  }

  async logout(refreshToken: string): Promise<void> {
    // Mock implementation for demo mode
    return Promise.resolve();
  }

  // Mock admin methods
  async listUsers(): Promise<any[]> {
    return [];
  }

  async createUser(userData: any): Promise<any> {
    return { id: 'mock-user-' + Date.now(), ...userData };
  }

  async updateUser(userId: string, userData: any): Promise<any> {
    return { id: userId, ...userData };
  }

  async deactivateUser(userId: string): Promise<void> {
    return Promise.resolve();
  }

  async activateUser(userId: string): Promise<void> {
    return Promise.resolve();
  }

  async changeUserPassword(userId: string, passwordData: any): Promise<void> {
    return Promise.resolve();
  }

  async resendInvitation(userId: string): Promise<void> {
    return Promise.resolve();
  }
}
