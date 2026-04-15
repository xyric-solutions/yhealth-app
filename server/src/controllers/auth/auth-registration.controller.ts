/**
 * @file Auth Registration Controller
 * @description Handles user registration (local and social)
 */

import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { query, transaction } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { generateTokens } from '../../middlewares/auth.middleware.js';
import { emailService, logger } from '../../services/index.js';
import { mailHelper } from '../../helper/mail.js';
import { env } from '../../config/env.config.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { notificationService } from '../../services/notification.service.js';
import { chatService } from '../../services/chat.service.js';
import type {
  RegisterInput,
  SocialAuthInput,
  CompleteSocialProfileInput,
  VerifyRegistrationInput,
  ResendRegistrationOTPInput,
} from '../../validators/auth.validator.js';
import { hashPassword } from '@/helper/encryption.js';
import {
  type ActivationTokenPayload,
  type UserRow,
  createActivationToken,
  mapUserRow,
  getPublicProfile,
} from './auth.types.js';

/**
 * S01.1.1: Core Account Registration - Step 1: Send OTP
 * POST /api/auth/register
 */
export const register = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as RegisterInput;

    // Check if email exists
    const existingResult = await query<UserRow>(
      'SELECT id FROM users WHERE email = $1',
      [data.email.toLowerCase()]
    );

    if (existingResult.rows.length > 0) {
      throw ApiError.conflict(
        'This email is already registered. Sign in or reset password?'
      );
    }

    // Hash password before storing in token
    const hashedPassword = await hashPassword(data.password);

    // Create registration data with hashed password
    const registrationData: RegisterInput = {
      ...data,
      email: data.email.toLowerCase(),
      password: hashedPassword,
    };

    // Generate activation token with 4-digit OTP
    const { token: activationToken, activationCode } =
      createActivationToken(registrationData);

    // Send OTP email
    await mailHelper.sendRegistrationOTPEmail(
      data.email,
      data.firstName,
      activationCode,
      '10 minutes'
    );

    logger.info('Registration OTP sent', { email: data.email });

    ApiResponse.success(
      res,
      {
        activationToken,
        message: 'Verification code sent to your email',
      },
      'Please check your email for the verification code'
    );
  }
);

/**
 * S01.1.1: Core Account Registration - Step 2: Verify OTP and Create Account
 * POST /api/auth/verify-registration
 */
export const verifyRegistration = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { activationToken, activationCode } =
      req.body as VerifyRegistrationInput;

    // Verify and decode the activation token
    let decoded: ActivationTokenPayload;
    try {
      decoded = jwt.verify(
        activationToken,
        env.jwt.secret
      ) as ActivationTokenPayload;
    } catch {
      throw ApiError.badRequest(
        'Invalid or expired verification code. Please register again.'
      );
    }

    // Verify the activation code matches
    if (decoded.activationCode !== activationCode) {
      throw ApiError.badRequest('Invalid verification code');
    }

    const userData = decoded.user;

    // Create user with preferences in a transaction
    // Let the database unique constraint handle race conditions
    let user;
    try {
      const DEFAULT_USER_ROLE_ID = '11111111-1111-1111-1111-111111111101';
      user = await transaction(async (client) => {
        const userResult = await client.query<UserRow>(
          `INSERT INTO users (
          email, password, first_name, last_name, date_of_birth, gender,
          auth_provider, onboarding_status, is_email_verified, role_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
          [
            userData.email,
            userData.password, // Already hashed
            userData.firstName,
            userData.lastName,
            new Date(userData.dateOfBirth),
            userData.gender,
            'local',
            'consent_pending',
            true, // Email is verified since they confirmed OTP
            DEFAULT_USER_ROLE_ID,
          ]
        );

        const newUser = userResult.rows[0];

        // Create default preferences
        await client.query('INSERT INTO user_preferences (user_id) VALUES ($1)', [
          newUser.id,
        ]);

        return mapUserRow(newUser);
      });
    } catch (err) {
      // Handle unique constraint violation (code 23505) - email already exists
      if ((err as { code?: string }).code === '23505') {
        throw ApiError.conflict(
          'This email is already registered. Sign in or reset password?'
        );
      }
      throw err;
    }

    // Send welcome email (non-blocking - don't fail registration if email fails)
    emailService.sendWelcomeEmail(user.email, user.firstName).catch((error) => {
      logger.warn('Failed to send welcome email (non-blocking)', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.id,
        email: user.email,
      });
    });

    // Send welcome notification
    await notificationService.welcomeUser(user.id, user.firstName);

    // Add user to Balencia Community group (non-blocking)
    chatService.addUserToCommunityGroup(user.id).catch((error) => {
      logger.warn('Failed to add user to community group (non-blocking)', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.id,
      });
    });

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Update user with refresh token
    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
      tokens.refreshToken,
      user.id,
    ]);

    logger.info('User registered after OTP verification', {
      userId: user.id,
      email: user.email,
    });

    ApiResponse.created(
      res,
      {
        user: getPublicProfile(user),
        tokens,
        nextStep: 'consent',
      },
      'Account created successfully'
    );
  }
);

/**
 * Resend Registration OTP
 * POST /api/auth/resend-registration-otp
 */
export const resendRegistrationOTP = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { activationToken } = req.body as ResendRegistrationOTPInput;

    // Verify and decode the activation token
    let decoded: ActivationTokenPayload;
    try {
      decoded = jwt.verify(
        activationToken,
        env.jwt.secret
      ) as ActivationTokenPayload;
    } catch {
      throw ApiError.badRequest('Session expired. Please register again.');
    }

    const userData = decoded.user;

    // Check if email was already registered
    const existingResult = await query<UserRow>(
      'SELECT id FROM users WHERE email = $1',
      [userData.email]
    );

    if (existingResult.rows.length > 0) {
      throw ApiError.conflict(
        'This email is already registered. Sign in or reset password?'
      );
    }

    // Generate new activation token with new 4-digit OTP
    const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const newToken = jwt.sign(
      {
        user: userData,
        activationCode,
      } as ActivationTokenPayload,
      env.jwt.secret,
      { expiresIn: '10m' }
    );

    // Send new OTP email
    await mailHelper.sendRegistrationOTPEmail(
      userData.email,
      userData.firstName,
      activationCode,
      '10 minutes'
    );

    logger.info('Registration OTP resent', { email: userData.email });

    ApiResponse.success(
      res,
      {
        activationToken: newToken,
        message: 'New verification code sent to your email',
      },
      'Please check your email for the new verification code'
    );
  }
);

/**
 * S01.1.2: Social Sign-In (Google/Apple) via NextAuth
 * POST /api/auth/social
 */
export const socialAuth = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as SocialAuthInput;

    // Validate required fields from NextAuth
    if (!data.email || !data.provider) {
      throw ApiError.badRequest('Email and provider are required');
    }

    const email = data.email.toLowerCase();
    const provider = data.provider;
    const providerId = data.providerId || data.idToken;

    // Check if user exists by email
    const existingUserResult = await query<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    let user: ReturnType<typeof mapUserRow>;
    let isNewUser = false;

    if (existingUserResult.rows.length > 0) {
      // User exists - verify and update provider info if needed
      user = mapUserRow(existingUserResult.rows[0]);

      // Update provider info and last login
      await query(
        `UPDATE users SET
        last_login = $1,
        auth_provider = COALESCE($2, auth_provider),
        provider_id = COALESCE($3, provider_id),
        avatar = COALESCE($4, avatar),
        is_email_verified = true
      WHERE id = $5`,
        [new Date(), provider, providerId || null, data.avatar || null, user.id]
      );

      // Refresh user data
      const updatedResult = await query<UserRow>(
        'SELECT * FROM users WHERE id = $1',
        [user.id]
      );
      user = mapUserRow(updatedResult.rows[0]);

      logger.info('Social sign-in', { userId: user.id, provider });
    } else {
      // New user - create account
      // Default role ID for regular users
      const DEFAULT_USER_ROLE_ID = '11111111-1111-1111-1111-111111111101';
      
      const newUserResult = await transaction(async (client) => {
        const userResult = await client.query<UserRow>(
          `INSERT INTO users (
          email, first_name, last_name, avatar, auth_provider, provider_id,
          is_email_verified, onboarding_status, role_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
          [
            email,
            data.firstName || data.name?.split(' ')[0] || '',
            data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
            data.avatar || null,
            provider,
            providerId,
            true,
            'consent_pending',
            DEFAULT_USER_ROLE_ID,
          ]
        );

        const newUser = userResult.rows[0];

        // Create default preferences
        await client.query(
          'INSERT INTO user_preferences (user_id) VALUES ($1)',
          [newUser.id]
        );

        return mapUserRow(newUser);
      });

      user = newUserResult;
      isNewUser = true;

      // Send welcome email
      if (user.firstName) {
        emailService.sendWelcomeEmail(user.email, user.firstName).catch((error) => {
          logger.warn('Failed to send welcome email (non-blocking)', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: user.id,
            email: user.email,
          });
        });
      }

      // Send welcome notification
      await notificationService.welcomeUser(user.id, user.firstName);

      // Add user to Balencia Community group (non-blocking)
      chatService.addUserToCommunityGroup(user.id).catch((error) => {
        logger.warn('Failed to add user to community group (non-blocking)', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: user.id,
        });
      });

      logger.info('Social registration', { userId: user.id, provider });
    }

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Update refresh token
    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
      tokens.refreshToken,
      user.id,
    ]);

    const responseData = {
      user: getPublicProfile(user),
      tokens,
      isNewUser,
      needsProfileCompletion: !user.dateOfBirth || !user.gender,
    };

    if (isNewUser) {
      ApiResponse.created(
        res,
        {
          ...responseData,
          nextStep:
            user.dateOfBirth && user.gender ? 'consent' : 'complete_profile',
        },
        'Account created successfully'
      );
    } else {
      ApiResponse.success(res, responseData, 'Signed in successfully');
    }
  }
);

/**
 * Complete social profile (DOB, Gender for social sign-up)
 * POST /api/auth/complete-profile
 */
export const completeSocialProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as CompleteSocialProfileInput;

    const result = await query<UserRow>(
      `UPDATE users SET
        date_of_birth = $1,
        gender = $2,
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *`,
      [
        new Date(data.dateOfBirth),
        data.gender,
        data.firstName || null,
        data.lastName || null,
        userId,
      ]
    );

    const user = mapUserRow(result.rows[0]);

    logger.info('Profile completed', { userId });

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(user),
        nextStep: 'consent',
      },
      'Profile updated successfully'
    );
  }
);
