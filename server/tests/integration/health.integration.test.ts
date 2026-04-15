/**
 * Health Check API Integration Tests
 */

import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Application } from 'express';

describe('Health Check API Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/health', () => {
    const endpoint = '/api/health';

    it('should return health status', async () => {
      const response = await request(app)
        .get(endpoint)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/health/live', () => {
    const endpoint = '/api/health/live';

    it('should return liveness status', async () => {
      const response = await request(app)
        .get(endpoint)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'alive');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/health/ready', () => {
    const endpoint = '/api/health/ready';

    it('should return readiness status', async () => {
      const response = await request(app)
        .get(endpoint);

      // May be 200 (ready) or 503 (not ready if DB unavailable in test)
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('status', 'ready');
      } else {
        expect(response.body).toHaveProperty('status', 'not_ready');
      }
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET / (Root endpoint)', () => {
    it('should return API info', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });
});
