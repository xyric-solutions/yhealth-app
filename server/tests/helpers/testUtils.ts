/**
 * Test Utilities and Helpers
 * Uses PostgreSQL-based user creation (no Mongoose dependency)
 */

import { faker } from '@faker-js/faker';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../../src/database/pg.js';
import type { IJwtPayload, UserRole } from '../../src/types/index.js';

// JWT Secret for testing
const JWT_SECRET = process.env['JWT_SECRET'] || 'test-jwt-secret';
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] || 'test-jwt-refresh-secret';

/**
 * Test user shape returned from PostgreSQL
 */
export interface TestUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_email_verified: boolean;
  onboarding_status: string;
}

/**
 * Generate fake user data
 */
export function generateUserData(overrides: Partial<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  dateOfBirth: Date;
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
}> = {}) {
  return {
    email: faker.internet.email().toLowerCase(),
    password: 'TestPassword123!',
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    dateOfBirth: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
    gender: faker.helpers.arrayElement(['male', 'female', 'non_binary', 'prefer_not_to_say']) as 'male' | 'female' | 'non_binary' | 'prefer_not_to_say',
    role: 'user' as UserRole,
    ...overrides,
  };
}

/**
 * Create a test user in the PostgreSQL database
 */
export async function createTestUser(overrides: Partial<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isEmailVerified: boolean;
  onboardingStatus: string;
}> = {}): Promise<TestUser> {
  const userData = generateUserData(overrides);
  const hashedPassword = await bcrypt.hash(userData.password, 12);

  // Map role name to role_id UUID
  const roleMap: Record<string, string> = {
    user: '11111111-1111-1111-1111-111111111101',
    admin: '11111111-1111-1111-1111-111111111102',
    moderator: '11111111-1111-1111-1111-111111111103',
    doctor: '11111111-1111-1111-1111-111111111104',
  };
  const roleId = roleMap[userData.role] || roleMap['user'];

  const result = await query<TestUser>(
    `INSERT INTO users (
      email, password, first_name, last_name,
      auth_provider, onboarding_status, is_email_verified, is_active, role_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, email, first_name, last_name,
      (SELECT slug FROM roles WHERE id = role_id) as role,
      is_email_verified, onboarding_status`,
    [
      userData.email,
      hashedPassword,
      userData.firstName,
      userData.lastName,
      'local',
      overrides.onboardingStatus ?? 'registered',
      overrides.isEmailVerified ?? true,
      true,
      roleId,
    ]
  );

  return result.rows[0];
}

/**
 * Generate JWT tokens for a test user
 */
export function generateTestTokens(user: TestUser): {
  accessToken: string;
  refreshToken: string;
} {
  const payload: Omit<IJwtPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m',
    issuer: 'yhealth-api-test',
    audience: 'yhealth-client-test',
  });

  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '7d',
    issuer: 'yhealth-api-test',
    audience: 'yhealth-client-test',
  });

  return { accessToken, refreshToken };
}

/**
 * Create authenticated test user with tokens
 */
export async function createAuthenticatedUser(overrides: Partial<{
  email: string;
  role: UserRole;
}> = {}): Promise<{
  user: TestUser;
  accessToken: string;
  refreshToken: string;
}> {
  const user = await createTestUser(overrides);
  const { accessToken, refreshToken } = generateTestTokens(user);
  return { user, accessToken, refreshToken };
}

/**
 * Generate fake goal data
 */
export function generateGoalData(overrides: Partial<{
  category: string;
  title: string;
  description: string;
  targetValue: number;
  targetUnit: string;
}> = {}) {
  const categories = [
    'weight_loss',
    'muscle_building',
    'sleep_improvement',
    'stress_wellness',
    'energy_productivity',
  ];

  return {
    category: faker.helpers.arrayElement(categories),
    title: faker.lorem.sentence(4),
    description: faker.lorem.paragraph(),
    targetValue: faker.number.int({ min: 1, max: 100 }),
    targetUnit: faker.helpers.arrayElement(['kg', 'lbs', 'hours', 'minutes', 'days']),
    pillar: faker.helpers.arrayElement(['fitness', 'nutrition', 'wellbeing']),
    motivation: faker.lorem.sentence(),
    confidenceLevel: faker.number.int({ min: 1, max: 10 }),
    timeline: {
      startDate: new Date(),
      targetDate: faker.date.future(),
      durationWeeks: faker.number.int({ min: 4, max: 52 }),
    },
    ...overrides,
  };
}

/**
 * Generate fake assessment response data
 */
export function generateAssessmentData(overrides: Partial<{
  assessmentType: 'quick' | 'deep';
  goalCategory: string;
}> = {}) {
  return {
    assessmentType: faker.helpers.arrayElement(['quick', 'deep']) as 'quick' | 'deep',
    goalCategory: faker.helpers.arrayElement([
      'weight_loss',
      'muscle_building',
      'sleep_improvement',
    ]),
    responses: [
      {
        questionId: 'q1',
        value: faker.helpers.arrayElement(['option1', 'option2', 'option3']),
        answeredAt: new Date(),
      },
      {
        questionId: 'q2',
        value: faker.number.int({ min: 1, max: 10 }),
        answeredAt: new Date(),
      },
    ],
    baselineData: {
      activityDaysPerWeek: faker.number.int({ min: 0, max: 7 }),
      moodRating: faker.number.int({ min: 1, max: 10 }),
      stressLevel: faker.number.int({ min: 1, max: 10 }),
      sleepQuality: faker.number.int({ min: 1, max: 10 }),
    },
    ...overrides,
  };
}

/**
 * Generate fake preferences data
 */
export function generatePreferencesData(overrides: Partial<{
  coachingStyle: string;
  coachingIntensity: string;
}> = {}) {
  return {
    notifications: {
      email: {
        enabled: faker.datatype.boolean(),
        frequency: faker.helpers.arrayElement(['instant', 'daily_digest', 'weekly_digest']),
        types: ['reminders', 'progress_updates'],
      },
      push: {
        enabled: faker.datatype.boolean(),
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '07:00',
        },
      },
    },
    coaching: {
      style: faker.helpers.arrayElement(['supportive', 'direct', 'analytical', 'motivational']),
      intensity: faker.helpers.arrayElement(['gentle', 'moderate', 'intensive']),
    },
    display: {
      theme: faker.helpers.arrayElement(['light', 'dark', 'system']),
      language: 'en',
      timezone: 'UTC',
      units: {
        weight: faker.helpers.arrayElement(['kg', 'lbs']),
        height: faker.helpers.arrayElement(['cm', 'ft']),
        distance: faker.helpers.arrayElement(['km', 'mi']),
        temperature: faker.helpers.arrayElement(['celsius', 'fahrenheit']),
      },
    },
    ...overrides,
  };
}

/**
 * Wait for a specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate random UUID string
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Clean up test data from PostgreSQL
 */
export async function cleanupTestData(userId?: string): Promise<void> {
  if (userId) {
    // Delete user-related data in reverse dependency order
    await query(`DELETE FROM daily_user_scores WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM activity_events WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM health_data_records WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM user_integrations WHERE user_id = $1`, [userId]);
    await query(`DELETE FROM users WHERE id = $1`, [userId]);
  }
}
