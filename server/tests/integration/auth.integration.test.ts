/**
 * Auth API Integration Tests
 *
 * Note: Registration is a 2-step OTP flow:
 * 1. POST /register → sends OTP to email, returns activationToken
 * 2. POST /verify-registration → verifies OTP, creates account
 *
 * We test step 1 and validation. For login/me/consent/refresh/logout,
 * we use createTestUser/createAuthenticatedUser which insert directly into DB.
 */

import request from 'supertest';
import { createApp } from '../../src/app.js';
import { query } from '../../src/database/pg.js';
import { generateUserData, createTestUser, createAuthenticatedUser } from '../helpers/testUtils.js';
import type { Application } from 'express';

describe('Auth API Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  describe('POST /api/auth/register', () => {
    const endpoint = '/api/auth/register';

    it('should start registration and return activation token', async () => {
      const userData = generateUserData({
        email: `register-${Date.now()}@example.com`,
      });

      const response = await request(app)
        .post(endpoint)
        .send(userData)
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('activationToken');
    });

    it('should return validation error for invalid email', async () => {
      const response = await request(app)
        .post(endpoint)
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-05-15',
          gender: 'male',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 409 for duplicate email', async () => {
      // Create a user directly in DB first
      const existingUser = await createTestUser({
        email: `dup-${Date.now()}@example.com`,
      });

      // Try to register with the same email
      const response = await request(app)
        .post(endpoint)
        .send({
          email: existingUser.email,
          password: 'SecurePass123!',
          firstName: 'Second',
          lastName: 'User',
          dateOfBirth: '1990-05-15',
          gender: 'female',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post(endpoint)
        .send({
          email: `weakpwd-${Date.now()}@example.com`,
          password: '123',
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-05-15',
          gender: 'male',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    const endpoint = '/api/auth/login';
    let testEmail: string;

    beforeAll(async () => {
      testEmail = `login-${Date.now()}@example.com`;
      await createTestUser({
        email: testEmail,
        password: 'SecurePass123!',
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post(endpoint)
        .send({
          email: testEmail,
          password: 'SecurePass123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post(endpoint)
        .send({
          email: testEmail,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post(endpoint)
        .send({
          email: `nonexistent-${Date.now()}@example.com`,
          password: 'SomePassword123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should be case-insensitive for email', async () => {
      const response = await request(app)
        .post(endpoint)
        .send({
          email: testEmail.toUpperCase(),
          password: 'SecurePass123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    const endpoint = '/api/auth/me';

    it('should return current user profile with valid token', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get(endpoint)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/consent', () => {
    const endpoint = '/api/auth/consent';

    it('should record user consent', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          termsOfService: true,
          privacyPolicy: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(endpoint)
        .send({
          termsOfService: true,
          privacyPolicy: true,
        })
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    const endpoint = '/api/auth/refresh';

    it('should refresh tokens with valid refresh token', async () => {
      const { refreshToken, user } = await createAuthenticatedUser();

      // Store refresh token in DB (required for refresh validation)
      await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

      const response = await request(app)
        .post(endpoint)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
    });
  });

  describe('POST /api/auth/logout', () => {
    const endpoint = '/api/auth/logout';

    it('should logout successfully', async () => {
      const { accessToken } = await createAuthenticatedUser();

      const response = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(endpoint)
        .expect(401);
    });
  });
});
