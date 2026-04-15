/**
 * Auth Validator Unit Tests
 */

import {
  registerSchema,
  loginSchema,
  socialAuthSchema,
  consentSchema,
  whatsAppEnrollmentSchema,
  whatsAppVerificationSchema,
  refreshTokenSchema,
} from '../../../src/validators/auth.validator.js';

describe('Auth Validators', () => {
  describe('registerSchema', () => {
    const validData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-15',
      gender: 'male',
    };

    it('should validate correct registration data', () => {
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        ...validData,
        email: 'invalid-email',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toContain('email');
      }
    });

    it('should reject weak password', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: '123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid gender', () => {
      const result = registerSchema.safeParse({
        ...validData,
        gender: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    it('should accept all valid gender options', () => {
      const genders = ['male', 'female', 'non_binary', 'prefer_not_to_say'];

      for (const gender of genders) {
        const result = registerSchema.safeParse({ ...validData, gender });
        expect(result.success).toBe(true);
      }
    });

    it('should reject future birth date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const result = registerSchema.safeParse({
        ...validData,
        dateOfBirth: futureDate.toISOString().split('T')[0],
      });
      expect(result.success).toBe(false);
    });

    it('should reject names that are too short', () => {
      const result = registerSchema.safeParse({
        ...validData,
        firstName: 'A',
      });
      expect(result.success).toBe(false);
    });

    it('should transform email to lowercase', () => {
      const result = registerSchema.safeParse({
        ...validData,
        email: 'TEST@EXAMPLE.COM',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });
  });

  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('socialAuthSchema', () => {
    it('should validate Google auth data', () => {
      const result = socialAuthSchema.safeParse({
        provider: 'google',
        email: 'user@gmail.com',
        idToken: 'some-google-id-token',
      });
      expect(result.success).toBe(true);
    });

    it('should validate Apple auth data', () => {
      const result = socialAuthSchema.safeParse({
        provider: 'apple',
        email: 'user@icloud.com',
        idToken: 'some-apple-id-token',
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid provider', () => {
      const result = socialAuthSchema.safeParse({
        provider: 'facebook',
        email: 'user@example.com',
        idToken: 'some-token',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing email', () => {
      const result = socialAuthSchema.safeParse({
        provider: 'google',
        idToken: 'some-token',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('consentSchema', () => {
    it('should validate consent data with required fields', () => {
      const result = consentSchema.safeParse({
        termsOfService: true,
        privacyPolicy: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject when termsOfService is false', () => {
      const result = consentSchema.safeParse({
        termsOfService: false,
        privacyPolicy: true,
      });
      expect(result.success).toBe(false);
    });

    it('should reject when privacyPolicy is false', () => {
      const result = consentSchema.safeParse({
        termsOfService: true,
        privacyPolicy: false,
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional marketing consents', () => {
      const result = consentSchema.safeParse({
        termsOfService: true,
        privacyPolicy: true,
        emailMarketing: true,
        whatsAppCoaching: false,
      });
      expect(result.success).toBe(true);
    });

    it('should default optional consents to false', () => {
      const result = consentSchema.safeParse({
        termsOfService: true,
        privacyPolicy: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.emailMarketing).toBe(false);
        expect(result.data.whatsAppCoaching).toBe(false);
      }
    });
  });

  describe('whatsAppEnrollmentSchema', () => {
    it('should validate WhatsApp enrollment data', () => {
      const result = whatsAppEnrollmentSchema.safeParse({
        phoneNumber: '+1234567890',
        countryCode: '+1',
      });
      expect(result.success).toBe(true);
    });

    it('should reject phone number starting with 0', () => {
      const result = whatsAppEnrollmentSchema.safeParse({
        phoneNumber: '01234567890',
        countryCode: '+1',
      });
      expect(result.success).toBe(false);
    });

    it('should accept phone numbers with + prefix', () => {
      const result = whatsAppEnrollmentSchema.safeParse({
        phoneNumber: '+14155552671',
        countryCode: '+1',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid country codes', () => {
      const validCodes = ['+1', '+44', '+91', '+86'];

      for (const countryCode of validCodes) {
        const result = whatsAppEnrollmentSchema.safeParse({
          phoneNumber: '+1234567890',
          countryCode,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('whatsAppVerificationSchema', () => {
    it('should validate verification data', () => {
      const result = whatsAppVerificationSchema.safeParse({
        code: '123456',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid code format (too short)', () => {
      const result = whatsAppVerificationSchema.safeParse({
        code: '12345', // Too short
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric code', () => {
      const result = whatsAppVerificationSchema.safeParse({
        code: 'abcdef',
      });
      expect(result.success).toBe(false);
    });

    it('should reject code that is too long', () => {
      const result = whatsAppVerificationSchema.safeParse({
        code: '1234567',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('refreshTokenSchema', () => {
    it('should validate refresh token', () => {
      const result = refreshTokenSchema.safeParse({
        refreshToken: 'some-refresh-token',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing refresh token', () => {
      const result = refreshTokenSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty refresh token', () => {
      const result = refreshTokenSchema.safeParse({
        refreshToken: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
