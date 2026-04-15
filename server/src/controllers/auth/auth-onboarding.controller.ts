/**
 * @file Auth Onboarding Controller
 * @description Handles consent, WhatsApp enrollment, and user status
 */

import type { Response } from 'express';
import { query, transaction } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { emailService, smsService, logger } from '../../services/index.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import type {
  ConsentInput,
  WhatsAppEnrollmentInput,
  WhatsAppVerificationInput,
  UpdateProfileInput,
} from '../../validators/auth.validator.js';
import {
  type UserRow,
  type ConsentRow,
  type WhatsAppRow,
  CONSENT_VERSION,
  mapUserRow,
  getPublicProfile,
  hasConsent,
} from './auth.types.js';

/**
 * S01.1.3: Privacy Consent
 * POST /api/auth/consent
 */
export const submitConsent = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as ConsentInput;

    const userResult = await query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) throw ApiError.notFound('User not found');
    const user = mapUserRow(userResult.rows[0]);

    const ip = req.ip || req.headers['x-forwarded-for']?.toString() || '';
    const now = new Date();

    // Upsert consents and update user in transaction
    await transaction(async (client) => {
      // Upsert terms_of_service consent
      await client.query(
        `INSERT INTO consent_records (user_id, type, version, consented_at, ip)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, type) DO UPDATE SET
         version = EXCLUDED.version,
         consented_at = EXCLUDED.consented_at,
         ip = EXCLUDED.ip`,
        [userId, 'terms_of_service', CONSENT_VERSION, now, ip]
      );

      // Upsert privacy_policy consent
      await client.query(
        `INSERT INTO consent_records (user_id, type, version, consented_at, ip)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, type) DO UPDATE SET
         version = EXCLUDED.version,
         consented_at = EXCLUDED.consented_at,
         ip = EXCLUDED.ip`,
        [userId, 'privacy_policy', CONSENT_VERSION, now, ip]
      );

      // Add optional email_marketing consent
      if (data.emailMarketing) {
        await client.query(
          `INSERT INTO consent_records (user_id, type, version, consented_at, ip)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, type) DO UPDATE SET
           version = EXCLUDED.version,
           consented_at = EXCLUDED.consented_at,
           ip = EXCLUDED.ip`,
          [userId, 'email_marketing', CONSENT_VERSION, now, ip]
        );
      }

      // Update onboarding status
      await client.query(
        `UPDATE users SET onboarding_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        ['assessment_pending', userId]
      );
    });

    // Send welcome email if not already sent (non-blocking - don't fail if email fails)
    if (!user.isEmailVerified && user.authProvider === 'local') {
      emailService.sendWelcomeEmail(user.email, user.firstName).catch((error) => {
        logger.warn('Failed to send welcome email (non-blocking)', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          email: user.email,
        });
      });
    }

    const updatedUserResult = await query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    const updatedUser = mapUserRow(updatedUserResult.rows[0]);

    logger.info('Consent submitted', { userId });

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(updatedUser),
        nextStep: 'whatsapp_enrollment',
      },
      'Consent recorded successfully'
    );
  }
);

/**
 * WhatsApp Enrollment - Send Verification Code
 * POST /api/auth/whatsapp/enroll
 */
export const enrollWhatsApp = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as WhatsAppEnrollmentInput;

    const userResult = await query<UserRow>(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) throw ApiError.notFound('User not found');

    // Check if phone is already taken
    const phoneTakenResult = await query<WhatsAppRow>(
      'SELECT id FROM whatsapp_enrollments WHERE phone_number = $1 AND user_id != $2',
      [data.phoneNumber, userId]
    );

    if (phoneTakenResult.rows.length > 0) {
      throw ApiError.conflict('This phone number is already registered');
    }

    // Send verification code
    const result = await smsService.sendVerificationCode(
      data.phoneNumber,
      data.countryCode
    );

    if (!result.success) {
      throw ApiError.badRequest(
        result.message || 'Failed to send verification code'
      );
    }

    // Store phone number (unverified) - upsert
    await query(
      `INSERT INTO whatsapp_enrollments (user_id, phone_number, country_code, is_verified)
     VALUES ($1, $2, $3, false)
     ON CONFLICT (user_id) DO UPDATE SET
       phone_number = EXCLUDED.phone_number,
       country_code = EXCLUDED.country_code,
       is_verified = false,
       verified_at = NULL,
       consented_at = NULL`,
      [userId, data.phoneNumber, data.countryCode]
    );

    logger.info('WhatsApp enrollment started', { userId });

    ApiResponse.success(
      res,
      {
        expiresIn: result.expiresIn,
      },
      'Verification code sent'
    );
  }
);

/**
 * WhatsApp Verification
 * POST /api/auth/whatsapp/verify
 */
export const verifyWhatsApp = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as WhatsAppVerificationInput;

    const whatsAppResult = await query<WhatsAppRow>(
      'SELECT * FROM whatsapp_enrollments WHERE user_id = $1',
      [userId]
    );

    if (whatsAppResult.rows.length === 0) {
      throw ApiError.badRequest(
        'No WhatsApp enrollment found. Please enroll first.'
      );
    }

    const whatsApp = whatsAppResult.rows[0];

    // Verify code
    const result = smsService.verifyCode(
      whatsApp.phone_number,
      whatsApp.country_code,
      data.code
    );

    if (!result.success) {
      throw ApiError.badRequest(result.message || 'Invalid verification code');
    }

    const ip = req.ip || '';
    const now = new Date();

    // Update WhatsApp enrollment and add consent in transaction
    await transaction(async (client) => {
      await client.query(
        `UPDATE whatsapp_enrollments SET
        is_verified = true,
        verified_at = $1,
        consented_at = $1
      WHERE user_id = $2`,
        [now, userId]
      );

      // Add WhatsApp consent
      await client.query(
        `INSERT INTO consent_records (user_id, type, version, consented_at, ip)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, type) DO UPDATE SET
         version = EXCLUDED.version,
         consented_at = EXCLUDED.consented_at,
         ip = EXCLUDED.ip`,
        [userId, 'whatsapp_coaching', CONSENT_VERSION, now, ip]
      );
    });

    const userResult = await query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    const user = mapUserRow(userResult.rows[0]);

    logger.info('WhatsApp verified', { userId });

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(user),
        nextStep: 'assessment',
      },
      'WhatsApp verified successfully'
    );
  }
);

/**
 * Skip WhatsApp Enrollment
 * POST /api/auth/whatsapp/skip
 */
export const skipWhatsApp = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Delete any partial WhatsApp enrollment
    await query('DELETE FROM whatsapp_enrollments WHERE user_id = $1', [
      userId,
    ]);

    logger.info('WhatsApp enrollment skipped', { userId });

    ApiResponse.success(
      res,
      {
        nextStep: 'assessment',
      },
      'WhatsApp enrollment skipped'
    );
  }
);

/**
 * Get current user
 * GET /api/auth/me
 */
export const getCurrentUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const userResult = await query<UserRow>(
      `SELECT u.*, r.slug as role FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) throw ApiError.notFound('User not found');

    const user = mapUserRow(userResult.rows[0]);

    ApiResponse.success(res, {
      user: getPublicProfile(user),
    });
  }
);

/**
 * Get onboarding status
 * GET /api/auth/onboarding-status
 */
export const getOnboardingStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const userResult = await query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) throw ApiError.notFound('User not found');

    const user = mapUserRow(userResult.rows[0]);

    const consentsResult = await query<ConsentRow>(
      'SELECT * FROM consent_records WHERE user_id = $1',
      [userId]
    );
    const consents = consentsResult.rows;

    const whatsAppResult = await query<WhatsAppRow>(
      'SELECT * FROM whatsapp_enrollments WHERE user_id = $1',
      [userId]
    );
    const whatsApp = whatsAppResult.rows[0];

    const hasTerms = hasConsent(consents, 'terms_of_service');
    const hasPrivacy = hasConsent(consents, 'privacy_policy');

    const status = {
      currentStep: user.onboardingStatus,
      steps: {
        registered: true,
        consent: hasTerms && hasPrivacy,
        whatsApp: whatsApp?.is_verified || false,
        assessment:
          user.onboardingStatus !== 'registered' &&
          user.onboardingStatus !== 'consent_pending' &&
          user.onboardingStatus !== 'assessment_pending',
        goals: [
          'goals_pending',
          'preferences_pending',
          'plan_pending',
          'completed',
        ].includes(user.onboardingStatus),
        preferences: [
          'preferences_pending',
          'plan_pending',
          'completed',
        ].includes(user.onboardingStatus),
        plan: user.onboardingStatus === 'completed',
      },
      isComplete: user.onboardingStatus === 'completed',
      completedAt: user.onboardingCompletedAt,
    };

    ApiResponse.success(res, status);
  }
);

/**
 * Update user profile
 * PATCH /api/auth/profile
 */
export const updateProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as UpdateProfileInput;

    // Build update fields dynamically
    const updateFields: string[] = [];
    const values: (string | Date | null)[] = [];
    let paramIndex = 1;

    if (data.firstName !== undefined) {
      updateFields.push(`first_name = $${paramIndex++}`);
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      updateFields.push(`last_name = $${paramIndex++}`);
      values.push(data.lastName);
    }
    if (data.phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      values.push(data.phone);
    }
    if (data.avatar !== undefined) {
      updateFields.push(`avatar = $${paramIndex++}`);
      values.push(data.avatar);
    }
    if (data.dateOfBirth !== undefined) {
      updateFields.push(`date_of_birth = $${paramIndex++}`);
      values.push(data.dateOfBirth);
    }
    if (data.gender !== undefined) {
      updateFields.push(`gender = $${paramIndex++}`);
      values.push(data.gender);
    }

    if (updateFields.length === 0) {
      throw ApiError.badRequest('No fields to update');
    }

    // Add updated_at and user id
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query<UserRow>(updateQuery, values);

    if (result.rows.length === 0) {
      throw ApiError.notFound('User not found');
    }

    const user = mapUserRow(result.rows[0]);

    logger.info('Profile updated', { userId });

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(user),
      },
      'Profile updated successfully'
    );
  }
);
