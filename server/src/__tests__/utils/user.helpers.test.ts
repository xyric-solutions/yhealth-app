/**
 * @file User helpers tests
 */

import { jest } from '@jest/globals';
import type { UserRow, ConsentRow, MappedUser } from '../../database/schemas.js';

// Mock database
jest.unstable_mockModule('../../database/pg', () => ({
  query: jest.fn(),
}));

jest.unstable_mockModule('../../middlewares/auth.middleware', () => ({
  generateTokens: jest.fn().mockReturnValue({
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  }),
}));

// Dynamic imports after mocks
const {
  mapUserRow,
  getPublicProfile,
  hasConsent,
  CONSENT_VERSION,
} = await import('../../utils/user.helpers.js');

describe('User Helpers', () => {
  describe('mapUserRow', () => {
    const mockUserRow: UserRow = {
      id: '123',
      email: 'test@example.com',
      password: 'hashed-password',
      first_name: 'John',
      last_name: 'Doe',
      date_of_birth: new Date('1990-01-01'),
      gender: 'male',
      role_id: '11111111-1111-1111-1111-111111111101',
      role: 'user',
      is_active: true,
      is_email_verified: true,
      avatar: 'https://example.com/avatar.jpg',
      phone: '+1234567890',
      auth_provider: 'local',
      provider_id: null,
      onboarding_status: 'completed',
      onboarding_completed_at: new Date(),
      last_login: new Date(),
      refresh_token: 'token',
      password_reset_token: null,
      password_reset_expires: null,
      email_verification_token: null,
      email_verification_expires: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should convert snake_case to camelCase', () => {
      const result = mapUserRow(mockUserRow);

      expect(result.id).toBe('123');
      expect(result.email).toBe('test@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.dateOfBirth).toEqual(new Date('1990-01-01'));
      expect(result.isActive).toBe(true);
      expect(result.isEmailVerified).toBe(true);
      expect(result.authProvider).toBe('local');
      expect(result.onboardingStatus).toBe('completed');
    });

    it('should handle null values', () => {
      const rowWithNulls: UserRow = {
        ...mockUserRow,
        date_of_birth: null,
        gender: null,
        avatar: null,
        phone: null,
      };

      const result = mapUserRow(rowWithNulls);

      expect(result.dateOfBirth).toBeNull();
      expect(result.gender).toBeNull();
      expect(result.avatar).toBeNull();
      expect(result.phone).toBeNull();
    });
  });

  describe('getPublicProfile', () => {
    const mockMappedUser: MappedUser = {
      id: '123',
      email: 'test@example.com',
      password: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      role: 'user',
      isActive: true,
      isEmailVerified: true,
      avatar: 'https://example.com/avatar.jpg',
      phone: '+1234567890',
      authProvider: 'local',
      providerId: null,
      onboardingStatus: 'completed',
      onboardingCompletedAt: new Date(),
      lastLogin: new Date(),
      refreshToken: 'token',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return public profile without sensitive fields', () => {
      const result = getPublicProfile(mockMappedUser);

      expect(result.id).toBe('123');
      expect(result.email).toBe('test@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(result.isEmailVerified).toBe(true);
      expect(result.onboardingStatus).toBe('completed');
    });

    it('should not include password', () => {
      const result = getPublicProfile(mockMappedUser);
      expect((result as unknown as Record<string, unknown>).password).toBeUndefined();
    });

    it('should not include refreshToken', () => {
      const result = getPublicProfile(mockMappedUser);
      expect((result as unknown as Record<string, unknown>).refreshToken).toBeUndefined();
    });
  });

  describe('hasConsent', () => {
    const mockConsents: ConsentRow[] = [
      {
        id: '1',
        user_id: '123',
        type: 'terms_of_service',
        version: '1.0.0',
        consented_at: new Date(),
        ip: '127.0.0.1',
      },
      {
        id: '2',
        user_id: '123',
        type: 'privacy_policy',
        version: '1.0.0',
        consented_at: new Date(),
        ip: '127.0.0.1',
      },
    ];

    it('should return true if consent exists', () => {
      expect(hasConsent(mockConsents, 'terms_of_service')).toBe(true);
      expect(hasConsent(mockConsents, 'privacy_policy')).toBe(true);
    });

    it('should return false if consent does not exist', () => {
      expect(hasConsent(mockConsents, 'email_marketing')).toBe(false);
      expect(hasConsent(mockConsents, 'whatsapp_coaching')).toBe(false);
    });

    it('should return false for empty consents array', () => {
      expect(hasConsent([], 'terms_of_service')).toBe(false);
    });
  });

  describe('CONSENT_VERSION', () => {
    it('should be defined', () => {
      expect(CONSENT_VERSION).toBe('1.0.0');
    });
  });
});
