/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../app.module';
import { 
  createTestingModule, 
  mockRequest,
  mockClaims 
} from '../test/setup';

describe('API Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Authentication Endpoints', () => {
    it('should handle login endpoint', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
    });

    it('should handle refresh endpoint', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'mock_refresh_token' })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
    });
  });

  describe('Consults Endpoints', () => {
    it('should handle consults list endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/consults')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('consults');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should handle consult detail endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/consults/consult-123')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('id', 'consult-123');
    });
  });

  describe('Notifications Endpoints', () => {
    it('should handle notifications list endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('notifications');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should handle notification stats endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/stats')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('unread');
    });
  });

  describe('Admin Endpoints', () => {
    it('should handle admin users list endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should handle admin organizations list endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/organizations')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('organizations');
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('Compliance Endpoints', () => {
    it('should handle security audit endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/compliance/security-audit')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('findings');
      expect(response.body).toHaveProperty('score');
    });

    it('should handle HIPAA compliance endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/compliance/hipaa-review')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('findings');
    });

    it('should handle SOC 2 compliance endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/compliance/soc2-review')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('trustServicePrinciples');
    });
  });

  describe('Business Metrics Endpoints', () => {
    it('should handle business metrics endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/metrics/business/consults-created')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('orgId');
    });
  });
});