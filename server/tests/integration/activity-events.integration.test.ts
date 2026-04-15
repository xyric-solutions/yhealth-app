/**
 * Activity Events API Integration Tests
 */

import { jest } from '@jest/globals';
import type { Application } from 'express';

// Mock activity ingestion service before importing app
const mockActivityIngestionService = {
  ingestEvent: jest.fn<() => Promise<unknown>>(),
  ingestEvents: jest.fn<() => Promise<unknown[]>>(),
  getUserEvents: jest.fn<() => Promise<unknown>>(),
};

jest.unstable_mockModule('../../src/services/activity-ingestion.service.js', () => ({
  activityIngestionService: mockActivityIngestionService,
  default: mockActivityIngestionService,
}));

jest.unstable_mockModule('../../src/services/logger.service.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), stream: { write: jest.fn() } },
}));

const { default: request } = await import('supertest');
const { createApp } = await import('../../src/app.js');
const { createAuthenticatedUser } = await import('../helpers/testUtils.js');

describe('Activity Events API Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/activity-events', () => {
    const endpoint = '/api/v1/activity-events';

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post(endpoint)
        .send({ events: [{ type: 'workout', source: 'manual', timestamp: '2026-02-16T10:00:00Z', payload: {} }] })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should submit activity events successfully', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const events = [
        { type: 'workout', source: 'manual', timestamp: '2026-02-16T10:00:00Z', payload: { duration_minutes: 45 } },
        { type: 'nutrition', source: 'manual', timestamp: '2026-02-16T12:00:00Z', payload: { calories: 500 } },
      ];

      mockActivityIngestionService.ingestEvents.mockResolvedValueOnce([
        { id: 'evt-1', ...events[0], user_id: 'test-user', confidence: 0.8 },
        { id: 'evt-2', ...events[1], user_id: 'test-user', confidence: 0.8 },
      ]);

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ events })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
    });

    it('should reject empty events array', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ events: [] })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing events field', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject more than 100 events', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const events = Array.from({ length: 101 }, (_, i) => ({
        type: 'workout',
        source: 'manual',
        timestamp: `2026-02-16T${String(i % 24).padStart(2, '0')}:00:00Z`,
        payload: {},
      }));

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ events })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('100');
    });
  });

  describe('GET /api/v1/activity-events', () => {
    const endpoint = '/api/v1/activity-events';

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get(endpoint)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return user activity events', async () => {
      const { accessToken } = await createAuthenticatedUser();

      mockActivityIngestionService.getUserEvents.mockResolvedValueOnce({
        events: [
          { id: 'evt-1', type: 'workout', source: 'manual', timestamp: '2026-02-16T10:00:00Z', payload: {} },
        ],
        total: 1,
      });

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
    });

    it('should pass query params to service', async () => {
      const { accessToken } = await createAuthenticatedUser();

      mockActivityIngestionService.getUserEvents.mockResolvedValueOnce({
        events: [],
        total: 0,
      });

      await request(app)
        .get(`${endpoint}?type=workout&startDate=2026-02-01&endDate=2026-02-16&limit=10&offset=5`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(mockActivityIngestionService.getUserEvents).toHaveBeenCalledWith(
        expect.any(String), // userId
        expect.objectContaining({
          type: 'workout',
          startDate: '2026-02-01',
          endDate: '2026-02-16',
          limit: 10,
          offset: 5,
        })
      );
    });

    it('should return empty events list when no events exist', async () => {
      const { accessToken } = await createAuthenticatedUser();

      mockActivityIngestionService.getUserEvents.mockResolvedValueOnce({
        events: [],
        total: 0,
      });

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(0);
    });
  });
});
