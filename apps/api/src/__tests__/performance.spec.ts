/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('API Performance Tests', () => {
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

  describe('Response Time Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should respond to auth login within 200ms', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com' })
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(200);
    });

    it('should respond to consults list within 300ms', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/consults')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(300);
    });

    it('should respond to notifications list within 300ms', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', 'Bearer mock_token')
        .expect(200);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(300);
    });
  });

  describe('Concurrent Request Tests', () => {
    it('should handle 10 concurrent health checks', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/health')
          .expect(200)
      );

      const startTime = Date.now();
      await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(1000); // All requests should complete within 1 second
    });

    it('should handle 5 concurrent auth requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com' })
          .expect(200)
      );

      const startTime = Date.now();
      await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      expect(totalTime).toBeLessThan(2000); // All requests should complete within 2 seconds
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during multiple requests', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Make multiple requests
      for (let i = 0; i < 100; i++) {
        await request(app.getHttpServer())
          .get('/health')
          .expect(200);
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle 404 errors quickly', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/nonexistent-endpoint')
        .expect(404);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle 401 errors quickly', async () => {
      const startTime = Date.now();
      
      await request(app.getHttpServer())
        .get('/consults')
        .expect(401);
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });
  });
});