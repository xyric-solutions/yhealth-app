/**
 * @file Auth Session Controller
 * @description Handles login, logout, and password operations
 */

import type { Response } from 'express';
import crypto from 'crypto';
import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { generateTokens } from '../../middlewares/auth.middleware.js';
import { emailService, logger } from '../../services/index.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import type {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '../../validators/auth.validator.js';
import { comparePassword, hashPassword } from '@/helper/encryption.js';
import { type UserRow, mapUserRow, getPublicProfile } from './auth.types.js';

/**
 * Login
 * POST /api/auth/login
 */
export const login = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as LoginInput;

    // Find user with password and role
    const userResult = await query<UserRow>(
      `SELECT u.*, r.slug as role FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [data.email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const user = mapUserRow(userResult.rows[0]);

    if (!user.password) {
      throw ApiError.unauthorized('Please sign in with your social account');
    }

    // Check password
    const isMatch = await comparePassword(data.password, user.password);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    // Check if account is active (blocked)
    if (!user.isActive) {
      throw ApiError.forbidden(
        'Your account has been blocked. Please contact our help center for assistance.'
      );
    }

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Update user
    await query(
      'UPDATE users SET last_login = $1, refresh_token = $2 WHERE id = $3',
      [new Date(), tokens.refreshToken, user.id]
    );

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(user),
        tokens,
      },
      'Logged in successfully'
    );
  }
);

/**
 * Refresh Token
 * POST /api/auth/refresh
 * Generates new access and refresh tokens with current user role from database
 * The verifyRefreshToken middleware validates the refresh token before this handler runs
 */
export const refreshToken = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
      throw ApiError.unauthorized('User ID not found in token');
    }

    // Get refresh token from request (already verified by middleware)
    const refreshTokenFromRequest = req.body.refreshToken || req.cookies?.['refresh_token'];

    // Fetch current user data with role from database
    const userResult = await query<UserRow>(
      `SELECT u.*, r.slug as role FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw ApiError.notFound('User not found');
    }

    const user = mapUserRow(userResult.rows[0]);

    // Check if account is active
    if (!user.isActive) {
      throw ApiError.forbidden(
        'Your account has been blocked. Please contact our help center for assistance.'
      );
    }

    // Verify refresh token matches stored token (security check)
    const storedTokenResult = await query<{ refresh_token: string | null }>(
      'SELECT refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (storedTokenResult.rows.length === 0 || !storedTokenResult.rows[0].refresh_token) {
      throw ApiError.unauthorized('Refresh token not found in database');
    }

    // Optional: Verify the token matches (for additional security)
    // This prevents using old refresh tokens after logout
    if (refreshTokenFromRequest && storedTokenResult.rows[0].refresh_token !== refreshTokenFromRequest) {
      throw ApiError.unauthorized('Refresh token mismatch');
    }

    // Generate new tokens with current role from database
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Update refresh token in database
    await query(
      'UPDATE users SET refresh_token = $1 WHERE id = $2',
      [tokens.refreshToken, user.id]
    );

    logger.info('Tokens refreshed', { userId: user.id, role: user.role });

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(user),
        tokens,
      },
      'Tokens refreshed successfully'
    );
  }
);

/**
 * Logout
 * POST /api/auth/logout
 */
export const logout = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (userId) {
      await query('UPDATE users SET refresh_token = NULL WHERE id = $1', [
        userId,
      ]);
      logger.info('User logged out', { userId });
    }

    ApiResponse.success(res, null, 'Logged out successfully');
  }
);

/**
 * Forgot Password
 * POST /api/auth/forgot-password
 */
export const forgotPassword = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as ForgotPasswordInput;

    const userResult = await query<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [data.email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      ApiResponse.success(
        res,
        null,
        'If the email exists, a reset link will be sent'
      );
      return;
    }

    const user = mapUserRow(userResult.rows[0]);

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    await query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [hashedToken, new Date(Date.now() + 60 * 60 * 1000), user.id] // 1 hour
    );

    // Send reset email
    await emailService.sendPasswordResetEmail(
      user.email,
      user.firstName,
      resetToken
    );

    logger.info('Password reset requested', { userId: user.id });

    ApiResponse.success(
      res,
      null,
      'If the email exists, a reset link will be sent'
    );
  }
);

/**
 * Reset Password
 * POST /api/auth/reset-password
 */
export const resetPassword = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as ResetPasswordInput;

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(data.token)
      .digest('hex');

    // Find user with valid token
    const userResult = await query<UserRow>(
      'SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > $2',
      [hashedToken, new Date()]
    );

    if (userResult.rows.length === 0) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    const user = mapUserRow(userResult.rows[0]);

    // Hash new password
    const hashedPassword = await hashPassword(data.password);

    // Update password
    await query(
      `UPDATE users SET
      password = $1,
      password_reset_token = NULL,
      password_reset_expires = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2`,
      [hashedPassword, user.id]
    );

    logger.info('Password reset', { userId: user.id });

    ApiResponse.success(res, null, 'Password reset successfully');
  }
);

/**
 * Verify Email
 * POST /api/auth/verify-email
 */
export const verifyEmail = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as VerifyEmailInput;

    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(data.token)
      .digest('hex');

    // Find user with valid token
    const userResult = await query<UserRow>(
      'SELECT * FROM users WHERE email_verification_token = $1 AND email_verification_expires > $2',
      [hashedToken, new Date()]
    );

    if (userResult.rows.length === 0) {
      throw ApiError.badRequest('Invalid or expired verification token');
    }

    const user = mapUserRow(userResult.rows[0]);

    // Verify email
    await query(
      `UPDATE users SET
      is_email_verified = true,
      email_verification_token = NULL,
      email_verification_expires = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1`,
      [user.id]
    );

    logger.info('Email verified', { userId: user.id });

    ApiResponse.success(res, null, 'Email verified successfully');
  }
);
