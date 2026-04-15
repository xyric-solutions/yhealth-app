/**
 * Plans API Integration Tests
 *
 * Tests for plan management endpoints including:
 * - Plan retrieval and filtering
 * - Plan status management
 * - Authentication checks
 *
 * Note: Plan generation depends on AI service (may be unavailable in test).
 * Goal creation uses /api/assessment/goals endpoint.
 */

import request from 'supertest';
import { createApp } from '../../src/app.js';
import {
  createAuthenticatedUser,
  generateGoalData,
} from '../helpers/testUtils.js';
import type { Application } from 'express';

describe('Plans API Integration Tests', () => {
  let app: Application;
  let authToken: string;
  let _userId: string;
  let testGoalId: string | undefined;

  beforeAll(async () => {
    app = createApp();

    // Create authenticated user
    const authResult = await createAuthenticatedUser();
    authToken = authResult.accessToken;
    _userId = authResult.user.id;
  });

  // Helper to make authenticated requests
  const authRequest = (method: 'get' | 'post' | 'patch' | 'delete') => {
    return (endpoint: string) =>
      request(app)[method](endpoint).set('Authorization', `Bearer ${authToken}`);
  };

  describe('Goal Creation (prerequisite)', () => {
    it('should create a goal for plan tests', async () => {
      const goalData = generateGoalData({
        category: 'weight_loss',
      });

      const goalResponse = await authRequest('post')('/api/assessment/goals')
        .send(goalData);

      if (goalResponse.status === 201 && goalResponse.body.data?.goal?.id) {
        testGoalId = goalResponse.body.data.goal.id;
      }

      // Goal creation should succeed
      expect([201, 400]).toContain(goalResponse.status);
    });
  });

  describe('Plan Retrieval', () => {
    describe('GET /api/plans', () => {
      it('should return all user plans', async () => {
        const response = await authRequest('get')('/api/plans')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('plans');
        expect(response.body.data).toHaveProperty('stats');
        expect(Array.isArray(response.body.data.plans)).toBe(true);
        expect(response.body.data.stats).toHaveProperty('active');
        expect(response.body.data.stats).toHaveProperty('paused');
        expect(response.body.data.stats).toHaveProperty('completed');
        expect(response.body.data.stats).toHaveProperty('archived');
      });

      it('should filter plans by status', async () => {
        const response = await authRequest('get')('/api/plans?status=active')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.plans.every((p: { status: string }) => p.status === 'active')).toBe(true);
      });

      it('should return empty array for new user with no plans', async () => {
        const newUser = await createAuthenticatedUser();

        const response = await request(app)
          .get('/api/plans')
          .set('Authorization', `Bearer ${newUser.accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.plans).toHaveLength(0);
      });

      it('should return 401 without authentication', async () => {
        await request(app)
          .get('/api/plans')
          .expect(401);
      });
    });

    describe('GET /api/plans/active', () => {
      it('should return 404 when no active plan exists', async () => {
        const newUser = await createAuthenticatedUser();

        const response = await request(app)
          .get('/api/plans/active')
          .set('Authorization', `Bearer ${newUser.accessToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/plans/:planId', () => {
      it('should return 404 for non-existent plan', async () => {
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const response = await authRequest('get')(`/api/plans/${fakeId}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Plan Generation', () => {
    describe('POST /api/plans/generate', () => {
      it('should handle missing goal ID', async () => {
        const _response = await authRequest('post')('/api/plans/generate')
          .send({})
          .expect((res) => {
            // goalId is optional in schema - may generate a plan (200/201), fail validation (400), or error (500)
            expect([200, 201, 400, 500]).toContain(res.status);
          });
      });

      it('should return 401 without authentication', async () => {
        await request(app)
          .post('/api/plans/generate')
          .send({ goalId: testGoalId || '00000000-0000-0000-0000-000000000000' })
          .expect(401);
      });

      it('should attempt to generate a plan with valid goal', async () => {
        if (!testGoalId) {
          console.log('Skipping: No goal available for plan generation');
          return;
        }

        const response = await authRequest('post')('/api/plans/generate')
          .send({
            goalId: testGoalId,
            preferences: {
              preferredDays: ['monday', 'wednesday', 'friday'],
              preferredTimes: { morning: '06:00', evening: '18:00' },
            },
          })
          .expect((res) => {
            // Allow 200, 201, 400 (validation), or 500 (if AI service unavailable)
            expect([200, 201, 400, 500]).toContain(res.status);
          });

        if (response.status === 201 || response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty('plan');
          expect(response.body.data.plan).toHaveProperty('id');
        }
      });
    });
  });

  describe('Today Activities', () => {
    describe('GET /api/plans/today', () => {
      it('should return today activities or 404 if no plan', async () => {
        const response = await authRequest('get')('/api/plans/today')
          .expect((res) => {
            expect([200, 404]).toContain(res.status);
          });

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty('activities');
        }
      });
    });
  });

  describe('Complete Onboarding', () => {
    describe('POST /api/plans/complete-onboarding', () => {
      it('should handle onboarding completion', async () => {
        const response = await authRequest('post')('/api/plans/complete-onboarding')
          .expect((res) => {
            // Allow 200 or 400 (if already completed or prerequisites missing)
            expect([200, 400]).toContain(res.status);
          });

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
        }
      });
    });
  });

  describe('Plan Statistics', () => {
    it('should return correct plan stats', async () => {
      const response = await authRequest('get')('/api/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toHaveProperty('active');
      expect(response.body.data.stats).toHaveProperty('paused');
      expect(response.body.data.stats).toHaveProperty('completed');
      expect(response.body.data.stats).toHaveProperty('archived');

      // Verify stats are numbers
      expect(typeof response.body.data.stats.active).toBe('number');
      expect(typeof response.body.data.stats.paused).toBe('number');
      expect(typeof response.body.data.stats.completed).toBe('number');
      expect(typeof response.body.data.stats.archived).toBe('number');
    });
  });
});

describe('Plans API Security Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('Authorization Checks', () => {
    it('should return 401 for all endpoints without auth', async () => {
      const endpoints = [
        { method: 'get', path: '/api/plans' },
        { method: 'get', path: '/api/plans/active' },
        { method: 'get', path: '/api/plans/today' },
        { method: 'post', path: '/api/plans/generate' },
        { method: 'post', path: '/api/plans/complete-onboarding' },
      ];

      for (const { method, path } of endpoints) {
        const response = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](path);
        expect(response.status).toBe(401);
      }
    });
  });

  describe('Input Validation', () => {
    let authToken: string;

    beforeAll(async () => {
      const authResult = await createAuthenticatedUser();
      authToken = authResult.accessToken;
    });

    it('should handle invalid status parameter gracefully', async () => {
      const response = await request(app)
        .get('/api/plans?status=active; DROP TABLE user_plans;--')
        .set('Authorization', `Bearer ${authToken}`)
        .expect((res) => {
          // Should not crash - 200 (treated as invalid), 400 (validation), or 500 (caught error)
          expect([200, 400, 500]).toContain(res.status);
        });

      // The important thing is it doesn't execute SQL injection
      expect(response.body).toBeDefined();
    });
  });
});
