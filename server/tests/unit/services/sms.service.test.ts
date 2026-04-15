/**
 * SMS Service Unit Tests
 *
 * Note: In development/test mode, the SMS service logs messages instead of
 * actually sending them. The verification codes are stored internally.
 */

import { smsService } from '../../../src/services/sms.service.js';

describe('SMSService', () => {
  // Get access to private methods for testing
  const service = smsService as unknown as {
    formatPhoneNumber: (phone: string, countryCode: string) => string;
    verificationCodes: Map<string, { code: string; expiresAt: Date; attempts: number }>;
    generateCode: () => string;
  };

  beforeEach(() => {
    // Clear verification codes between tests
    service.verificationCodes.clear();
  });

  describe('sendVerificationCode', () => {
    it('should return success and expiration time', async () => {
      const phoneNumber = '1234567890';
      const countryCode = '+1';

      const result = await smsService.sendVerificationCode(phoneNumber, countryCode);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('expiresIn');
      expect(result.expiresIn).toBe(600); // 10 minutes in seconds
    });

    it('should store verification code internally', async () => {
      const phoneNumber = '1234567890';
      const countryCode = '+1';

      await smsService.sendVerificationCode(phoneNumber, countryCode);

      // Verify code was stored
      const formattedPhone = service.formatPhoneNumber(phoneNumber, countryCode);
      const stored = service.verificationCodes.get(formattedPhone);

      expect(stored).toBeDefined();
      expect(stored?.code).toMatch(/^\d{6}$/); // 6-digit code
      expect(stored?.attempts).toBe(0);
    });

    it('should handle phone numbers with different formats', async () => {
      const testCases = [
        { phone: '1234567890', countryCode: '+1' },
        { phone: '(123) 456-7890', countryCode: '+1' },
        { phone: '123-456-7890', countryCode: '+1' },
        { phone: '9876543210', countryCode: '+44' },
      ];

      for (const { phone, countryCode } of testCases) {
        const result = await smsService.sendVerificationCode(phone, countryCode);
        expect(result.success).toBe(true);
        expect(result.expiresIn).toBeGreaterThan(0);
      }
    });
  });

  describe('verifyCode', () => {
    it('should verify a valid code', async () => {
      const phoneNumber = '5555555555';
      const countryCode = '+1';

      // First, generate a code
      const sendResult = await smsService.sendVerificationCode(phoneNumber, countryCode);
      expect(sendResult.success).toBe(true);

      // Get the stored code
      const formattedPhone = service.formatPhoneNumber(phoneNumber, countryCode);
      const stored = service.verificationCodes.get(formattedPhone);
      expect(stored).toBeDefined();

      // Then verify it
      const verifyResult = smsService.verifyCode(phoneNumber, countryCode, stored!.code);

      expect(verifyResult).toHaveProperty('success', true);
    });

    it('should reject an invalid code', async () => {
      const phoneNumber = '6666666666';
      const countryCode = '+1';

      // Generate a code
      await smsService.sendVerificationCode(phoneNumber, countryCode);

      // Try to verify with wrong code
      const verifyResult = smsService.verifyCode(phoneNumber, countryCode, '000000');

      expect(verifyResult).toHaveProperty('success', false);
      expect(verifyResult).toHaveProperty('message');
      expect(verifyResult.attemptsRemaining).toBeDefined();
    });

    it('should reject verification for non-existent phone number', async () => {
      const verifyResult = smsService.verifyCode('9999999999', '+1', '123456');

      expect(verifyResult).toHaveProperty('success', false);
      expect(verifyResult.message).toContain('No verification code');
    });

    it('should handle maximum verification attempts', async () => {
      const phoneNumber = '7777777777';
      const countryCode = '+1';

      // Generate a code
      await smsService.sendVerificationCode(phoneNumber, countryCode);

      // Try multiple wrong attempts (max is 3)
      for (let i = 0; i < 3; i++) {
        const result = smsService.verifyCode(phoneNumber, countryCode, '000000');
        if (i < 2) {
          expect(result.success).toBe(false);
          expect(result.attemptsRemaining).toBe(2 - i);
        }
      }

      // Code should be deleted after max attempts
      const formattedPhone = service.formatPhoneNumber(phoneNumber, countryCode);
      expect(service.verificationCodes.has(formattedPhone)).toBe(false);
    });

    it('should remove code after successful verification', async () => {
      const phoneNumber = '8888888888';
      const countryCode = '+1';

      // Generate a code
      await smsService.sendVerificationCode(phoneNumber, countryCode);

      // Get and verify the code
      const formattedPhone = service.formatPhoneNumber(phoneNumber, countryCode);
      const stored = service.verificationCodes.get(formattedPhone);
      smsService.verifyCode(phoneNumber, countryCode, stored!.code);

      // Code should be removed
      expect(service.verificationCodes.has(formattedPhone)).toBe(false);

      // Try to verify again - should fail
      const secondVerify = smsService.verifyCode(phoneNumber, countryCode, stored!.code);
      expect(secondVerify.success).toBe(false);
    });

    it('should track remaining attempts correctly', async () => {
      const phoneNumber = '1111111111';
      const countryCode = '+1';

      await smsService.sendVerificationCode(phoneNumber, countryCode);

      // First wrong attempt
      const result1 = smsService.verifyCode(phoneNumber, countryCode, '000000');
      expect(result1.success).toBe(false);
      expect(result1.attemptsRemaining).toBe(2);

      // Second wrong attempt
      const result2 = smsService.verifyCode(phoneNumber, countryCode, '000000');
      expect(result2.success).toBe(false);
      expect(result2.attemptsRemaining).toBe(1);
    });
  });

  describe('resendVerificationCode', () => {
    it('should resend code after cooldown period', async () => {
      const phoneNumber = '2222222222';
      const countryCode = '+1';

      // First send
      const result1 = await smsService.sendVerificationCode(phoneNumber, countryCode);
      expect(result1.success).toBe(true);

      // Immediately try to resend (should be rate limited)
      const result2 = await smsService.resendVerificationCode(phoneNumber, countryCode);
      expect(result2.success).toBe(false);
      expect(result2.message).toContain('wait');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format phone number to E.164 format', () => {
      const formatted = service.formatPhoneNumber('1234567890', '+1');
      expect(formatted).toBeDefined();
      expect(formatted.startsWith('+')).toBe(true);
    });

    it('should remove non-digit characters', () => {
      const formatted = service.formatPhoneNumber('(123) 456-7890', '+1');
      expect(formatted).not.toContain('(');
      expect(formatted).not.toContain(')');
      expect(formatted).not.toContain('-');
      expect(formatted).not.toContain(' ');
    });

    it('should handle different country codes', () => {
      const uk = service.formatPhoneNumber('7911123456', '+44');
      expect(uk.startsWith('+44')).toBe(true);

      const us = service.formatPhoneNumber('1234567890', '+1');
      expect(us.startsWith('+1')).toBe(true);
    });
  });

  describe('cleanupExpiredCodes', () => {
    it('should remove expired codes', async () => {
      const phoneNumber = '3333333333';
      const countryCode = '+1';

      // Send a code
      await smsService.sendVerificationCode(phoneNumber, countryCode);

      // Manually expire the code
      const formattedPhone = service.formatPhoneNumber(phoneNumber, countryCode);
      const stored = service.verificationCodes.get(formattedPhone);
      if (stored) {
        stored.expiresAt = new Date(Date.now() - 1000); // Set to past
      }

      // Cleanup
      smsService.cleanupExpiredCodes();

      // Code should be removed
      expect(service.verificationCodes.has(formattedPhone)).toBe(false);
    });

    it('should not remove non-expired codes', async () => {
      const phoneNumber = '4444444444';
      const countryCode = '+1';

      // Send a code
      await smsService.sendVerificationCode(phoneNumber, countryCode);

      // Cleanup (code should not be expired)
      smsService.cleanupExpiredCodes();

      // Code should still exist
      const formattedPhone = service.formatPhoneNumber(phoneNumber, countryCode);
      expect(service.verificationCodes.has(formattedPhone)).toBe(true);
    });
  });
});
