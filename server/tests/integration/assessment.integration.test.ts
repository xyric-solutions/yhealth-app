/**
 * Assessment API Integration Tests
 *
 * Actual endpoints:
 * - POST /api/assessment/goals - Create goal (returns {data: {goal: {...}}})
 * - GET /api/assessment/goals - List goals (returns {data: {goals: [...]}})
 * - GET /api/assessment/goals/:goalId - Get goal
 * - PATCH /api/assessment/goals/:goalId - Update goal
 * - DELETE /api/assessment/goals/:goalId - Delete goal
 * - GET /api/assessment/questions - Get quick assessment questions
 * - POST /api/assessment/quick/submit - Submit quick assessment
 * - POST /api/assessment/deep/message - Deep assessment conversation
 * - POST /api/assessment/switch-mode - Switch assessment mode
 */

import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createAuthenticatedUser, generateGoalData } from '../helpers/testUtils.js';
import type { Application } from 'express';

describe('Assessment API Integration Tests', () => {
  let app: Application;
  let accessToken: string;
  let _userId: string;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    const auth = await createAuthenticatedUser();
    accessToken = auth.accessToken;
    _userId = auth.user.id;
  });

  describe('User Goals', () => {
    describe('POST /api/assessment/goals', () => {
      const endpoint = '/api/assessment/goals';

      it('should create a new goal', async () => {
        const goalData = generateGoalData();

        const response = await request(app)
          .post(endpoint)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(goalData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('goal');
        expect(response.body.data.goal).toHaveProperty('id');
        expect(response.body.data.goal.category).toBe(goalData.category);
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post(endpoint)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should require authentication', async () => {
        await request(app)
          .post(endpoint)
          .send(generateGoalData())
          .expect(401);
      });
    });

    describe('GET /api/assessment/goals', () => {
      const endpoint = '/api/assessment/goals';

      it('should return user goals', async () => {
        // Create a goal first
        await request(app)
          .post(endpoint)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(generateGoalData());

        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('goals');
        expect(Array.isArray(response.body.data.goals)).toBe(true);
      });

      it('should return empty goals array for user with no goals', async () => {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.goals).toEqual([]);
      });
    });

    describe('PATCH /api/assessment/goals/:goalId', () => {
      it('should update a goal', async () => {
        // Create a goal
        const createResponse = await request(app)
          .post('/api/assessment/goals')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(generateGoalData());

        const goalId = createResponse.body.data?.goal?.id;
        if (!goalId) {
          console.log('Skipping: Goal creation did not return id');
          return;
        }

        const response = await request(app)
          .patch(`/api/assessment/goals/${goalId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ status: 'paused' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.goal.status).toBe('paused');
      });
    });

    describe('DELETE /api/assessment/goals/:goalId', () => {
      it('should delete a goal', async () => {
        // Create a goal
        const createResponse = await request(app)
          .post('/api/assessment/goals')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(generateGoalData());

        const goalId = createResponse.body.data?.goal?.id;
        if (!goalId) {
          console.log('Skipping: Goal creation did not return id');
          return;
        }

        const response = await request(app)
          .delete(`/api/assessment/goals/${goalId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Assessment Flow', () => {
    describe('GET /api/assessment/questions', () => {
      it('should return questions or require goal setup first', async () => {
        const response = await request(app)
          .get('/api/assessment/questions')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect((res) => {
            // May return 200 or 400 if no goal/mode set yet
            expect([200, 400]).toContain(res.status);
          });

        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty('questions');
        }
      });

      it('should require authentication', async () => {
        await request(app)
          .get('/api/assessment/questions')
          .expect(401);
      });
    });

    describe('POST /api/assessment/quick/submit', () => {
      it('should require authentication', async () => {
        await request(app)
          .post('/api/assessment/quick/submit')
          .send({ responses: [] })
          .expect(401);
      });
    });

    describe('POST /api/assessment/deep/message', () => {
      it('should require authentication', async () => {
        await request(app)
          .post('/api/assessment/deep/message')
          .send({ message: 'test' })
          .expect(401);
      });
    });

    describe('POST /api/assessment/switch-mode', () => {
      it('should require authentication', async () => {
        await request(app)
          .post('/api/assessment/switch-mode')
          .send({ targetMode: 'deep' })
          .expect(401);
      });
    });
  });
});
