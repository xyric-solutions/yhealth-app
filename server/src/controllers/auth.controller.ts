import type { Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { query, transaction } from "../database/pg.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateTokens } from "../middlewares/auth.middleware.js";
import { emailService, smsService, logger } from "../services/index.js";
import { mailHelper } from "../helper/mail.js";
import { env } from "../config/env.config.js";
import type { AuthenticatedRequest } from "../types/index.js";
import { notificationService } from "../services/notification.service.js";
import type {
  RegisterInput,
  LoginInput,
  SocialAuthInput,
  CompleteSocialProfileInput,
  ConsentInput,
  WhatsAppEnrollmentInput,
  WhatsAppVerificationInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
  VerifyRegistrationInput,
  ResendRegistrationOTPInput,
  UpdateProfileInput,
} from "../validators/auth.validator.js";
import { comparePassword, hashPassword } from "@/helper/encryption.js";
import { getPublicProfile as getPublicProfileHelper } from '../utils/user.helpers.js';
import type { MappedUser } from '../database/schemas/index.js';

// Activation token payload type
interface ActivationTokenPayload {
  user: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
  };
  activationCode: string;
}

/**
 * Generate activation token with 4-digit OTP code
 */
function createActivationToken(user: RegisterInput): {
  token: string;
  activationCode: string;
} {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
  const token = jwt.sign(
    {
      user: {
        email: user.email,
        password: user.password, // Already hashed
        firstName: user.firstName,
        lastName: user.lastName,
        dateOfBirth: user.dateOfBirth.toISOString(),
        gender: user.gender,
      },
      activationCode,
    } as ActivationTokenPayload,
    env.jwt.secret,
    { expiresIn: "10m" }
  );
  return { token, activationCode };
}

// Type definitions for raw PostgreSQL results
interface UserRow {
  id: string;
  email: string;
  password: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: Date | null;
  gender: string | null;
  role: string;
  is_active: boolean;
  is_email_verified: boolean;
  avatar: string | null;
  phone: string | null;
  auth_provider: string;
  provider_id: string | null;
  onboarding_status: string;
  onboarding_completed_at: Date | null;
  last_login: Date | null;
  refresh_token: string | null;
  password_reset_token: string | null;
  password_reset_expires: Date | null;
  email_verification_token: string | null;
  email_verification_expires: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface ConsentRow {
  id: string;
  user_id: string;
  type: string;
  version: string;
  consented_at: Date;
  ip: string | null;
}

interface WhatsAppRow {
  id: string;
  user_id: string;
  phone_number: string;
  country_code: string;
  is_verified: boolean;
  verified_at: Date | null;
  consented_at: Date | null;
}

const CONSENT_VERSION = "1.0.0";

// Helper to convert snake_case to camelCase user
function mapUserRow(row: UserRow): MappedUser {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    role: row.role,
    isActive: row.is_active,
    isEmailVerified: row.is_email_verified,
    avatar: row.avatar,
    phone: row.phone,
    authProvider: row.auth_provider,
    providerId: row.provider_id,
    onboardingStatus: row.onboarding_status,
    onboardingCompletedAt: row.onboarding_completed_at,
    lastLogin: row.last_login,
    refreshToken: row.refresh_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper to get public profile - uses helper from user.helpers.ts to ensure avatar URLs don't expire
function getPublicProfile(user: MappedUser) {
  return getPublicProfileHelper(user);
}

// Helper to check if user has consent
function hasConsent(consents: ConsentRow[], type: string): boolean {
  return consents.some((c) => c.type === type);
}

/**
 * S01.1.1: Core Account Registration - Step 1: Send OTP
 * POST /api/auth/register
 *
 * This endpoint validates registration data and sends a 4-digit OTP to the user's email.
 * The user account is NOT created until the OTP is verified via /api/auth/verify-registration.
 */
export const register = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as RegisterInput;

    // Check if email exists
    const existingResult = await query<UserRow>(
      "SELECT id FROM users WHERE email = $1",
      [data.email.toLowerCase()]
    );

    if (existingResult.rows.length > 0) {
      throw ApiError.conflict(
        "This email is already registered. Sign in or reset password?"
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
      "10 minutes"
    );

    logger.info("Registration OTP sent", { email: data.email });

    ApiResponse.success(
      res,
      {
        activationToken,
        message: "Verification code sent to your email",
      },
      "Please check your email for the verification code"
    );
  }
);

/**
 * S01.1.1: Core Account Registration - Step 2: Verify OTP and Create Account
 * POST /api/auth/verify-registration
 *
 * This endpoint verifies the OTP and creates the user account if valid.
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
        "Invalid or expired verification code. Please register again."
      );
    }

    // Verify the activation code matches
    if (decoded.activationCode !== activationCode) {
      throw ApiError.badRequest("Invalid verification code");
    }

    const userData = decoded.user;

    // Create user with preferences in a transaction
    // Let the database unique constraint handle race conditions
    let user;
    try {
      user = await transaction(async (client) => {
        const userResult = await client.query<UserRow>(
          `INSERT INTO users (
          email, password, first_name, last_name, date_of_birth, gender,
          auth_provider, onboarding_status, is_email_verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
          [
            userData.email,
            userData.password, 
            userData.firstName,
            userData.lastName,
            new Date(userData.dateOfBirth),
            userData.gender,
            "local",
            "consent_pending",
            true, 
          ]
        );

        const newUser = userResult.rows[0];

        // Create default preferences
        await client.query("INSERT INTO user_preferences (user_id) VALUES ($1)", [
          newUser.id,
        ]);

        return mapUserRow(newUser);
      });
    } catch (err) {
      // Handle unique constraint violation (code 23505) - email already exists
      if ((err as { code?: string }).code === '23505') {
        throw ApiError.conflict(
          "This email is already registered. Sign in or reset password?"
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

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Update user with refresh token
    await query("UPDATE users SET refresh_token = $1 WHERE id = $2", [
      tokens.refreshToken,
      user.id,
    ]);

    logger.info("User registered after OTP verification", {
      userId: user.id,
      email: user.email,
    });

    ApiResponse.created(
      res,
      {
        user: getPublicProfile(user),
        tokens,
        nextStep: "consent",
      },
      "Account created successfully"
    );
  }
);

/**
 * S01.1.2: Social Sign-In (Google/Apple) via NextAuth
 * POST /api/auth/social
 *
 * Frontend (NextAuth) handles OAuth flow and sends user data here.
 * Backend creates user if not exists, or verifies if exists.
 */
export const socialAuth = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as SocialAuthInput;

    // Validate required fields from NextAuth
    if (!data.email || !data.provider) {
      throw ApiError.badRequest("Email and provider are required");
    }

    const email = data.email.toLowerCase();
    const provider = data.provider;
    const providerId = data.providerId || data.idToken;

    // Check if user exists by email
    const existingUserResult = await query<UserRow>(
      "SELECT * FROM users WHERE email = $1",
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
        "SELECT * FROM users WHERE id = $1",
        [user.id]
      );
      user = mapUserRow(updatedResult.rows[0]);

      logger.info("Social sign-in", { userId: user.id, provider });
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
            data.firstName || data.name?.split(" ")[0] || "",
            data.lastName || data.name?.split(" ").slice(1).join(" ") || "",
            data.avatar || null,
            provider,
            providerId,
            true,
            "consent_pending",
            DEFAULT_USER_ROLE_ID,
          ]
        );

        const newUser = userResult.rows[0];

        // Create default preferences
        await client.query(
          "INSERT INTO user_preferences (user_id) VALUES ($1)",
          [newUser.id]
        );

        return mapUserRow(newUser);
      });

      user = newUserResult;
      isNewUser = true;

      // Send welcome email (non-blocking - don't fail registration if email fails)
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

      logger.info("Social registration", { userId: user.id, provider });
    }

    // Generate tokens
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Update refresh token
    await query("UPDATE users SET refresh_token = $1 WHERE id = $2", [
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
            user.dateOfBirth && user.gender ? "consent" : "complete_profile",
        },
        "Account created successfully"
      );
    } else {
      ApiResponse.success(res, responseData, "Signed in successfully");
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

    logger.info("Profile completed", { userId });

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(user),
        nextStep: "consent",
      },
      "Profile updated successfully"
    );
  }
);

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
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) throw ApiError.notFound("User not found");
    const user = mapUserRow(userResult.rows[0]);

    const ip = req.ip || req.headers["x-forwarded-for"]?.toString() || "";
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
        [userId, "terms_of_service", CONSENT_VERSION, now, ip]
      );

      // Upsert privacy_policy consent
      await client.query(
        `INSERT INTO consent_records (user_id, type, version, consented_at, ip)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, type) DO UPDATE SET
         version = EXCLUDED.version,
         consented_at = EXCLUDED.consented_at,
         ip = EXCLUDED.ip`,
        [userId, "privacy_policy", CONSENT_VERSION, now, ip]
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
          [userId, "email_marketing", CONSENT_VERSION, now, ip]
        );
      }

      // Update onboarding status
      await client.query(
        `UPDATE users SET onboarding_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        ["assessment_pending", userId]
      );
    });

    // Send welcome email if not already sent (non-blocking - don't fail if email fails)
    if (!user.isEmailVerified && user.authProvider === "local") {
      emailService.sendWelcomeEmail(user.email, user.firstName).catch((error) => {
        logger.warn('Failed to send welcome email (non-blocking)', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          email: user.email,
        });
      });
    }

    const updatedUserResult = await query<UserRow>(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );
    const updatedUser = mapUserRow(updatedUserResult.rows[0]);

    logger.info("Consent submitted", { userId });

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(updatedUser),
        nextStep: "whatsapp_enrollment",
      },
      "Consent recorded successfully"
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
      "SELECT id FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) throw ApiError.notFound("User not found");

    // Check if phone is already taken
    const phoneTakenResult = await query<WhatsAppRow>(
      "SELECT id FROM whatsapp_enrollments WHERE phone_number = $1 AND user_id != $2",
      [data.phoneNumber, userId]
    );

    if (phoneTakenResult.rows.length > 0) {
      throw ApiError.conflict("This phone number is already registered");
    }

    // Send verification code
    const result = await smsService.sendVerificationCode(
      data.phoneNumber,
      data.countryCode
    );

    if (!result.success) {
      throw ApiError.badRequest(
        result.message || "Failed to send verification code"
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

    logger.info("WhatsApp enrollment started", { userId });

    ApiResponse.success(
      res,
      {
        expiresIn: result.expiresIn,
      },
      "Verification code sent"
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
      "SELECT * FROM whatsapp_enrollments WHERE user_id = $1",
      [userId]
    );

    if (whatsAppResult.rows.length === 0) {
      throw ApiError.badRequest(
        "No WhatsApp enrollment found. Please enroll first."
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
      throw ApiError.badRequest(result.message || "Invalid verification code");
    }

    const ip = req.ip || "";
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
        [userId, "whatsapp_coaching", CONSENT_VERSION, now, ip]
      );
    });

    const userResult = await query<UserRow>(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );
    const user = mapUserRow(userResult.rows[0]);

    logger.info("WhatsApp verified", { userId });

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(user),
        nextStep: "assessment",
      },
      "WhatsApp verified successfully"
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
    await query("DELETE FROM whatsapp_enrollments WHERE user_id = $1", [
      userId,
    ]);

    logger.info("WhatsApp enrollment skipped", { userId });

    ApiResponse.success(
      res,
      {
        nextStep: "assessment",
      },
      "WhatsApp enrollment skipped"
    );
  }
);

/**
 * Login
 * POST /api/auth/login
 */
export const login = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const data = req.body as LoginInput;

    // Find user with password
    const userResult = await query<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [data.email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    const user = mapUserRow(userResult.rows[0]);

    if (!user.password) {
      throw ApiError.unauthorized("Please sign in with your social account");
    }

    // Check password
    const isMatch = await comparePassword(data.password, user.password);
    if (!isMatch) {
      throw ApiError.unauthorized("Invalid email or password");
    }

    // Check if account is active (blocked)
    if (!user.isActive) {
      throw ApiError.forbidden(
        "Your account has been blocked. Please contact our help center for assistance."
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
      "UPDATE users SET last_login = $1, refresh_token = $2 WHERE id = $3",
      [new Date(), tokens.refreshToken, user.id]
    );

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(user),
        tokens,
      },
      "Logged in successfully"
    );
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
      "SELECT * FROM users WHERE email = $1",
      [data.email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      ApiResponse.success(
        res,
        null,
        "If the email exists, a reset link will be sent"
      );
      return;
    }

    const user = mapUserRow(userResult.rows[0]);

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await query(
      "UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3",
      [hashedToken, new Date(Date.now() + 60 * 60 * 1000), user.id] // 1 hour
    );

    // Send reset email
    await emailService.sendPasswordResetEmail(
      user.email,
      user.firstName,
      resetToken
    );

    logger.info("Password reset requested", { userId: user.id });

    ApiResponse.success(
      res,
      null,
      "If the email exists, a reset link will be sent"
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
      .createHash("sha256")
      .update(data.token)
      .digest("hex");

    // Find user with valid token
    const userResult = await query<UserRow>(
      "SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > $2",
      [hashedToken, new Date()]
    );

    if (userResult.rows.length === 0) {
      throw ApiError.badRequest("Invalid or expired reset token");
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

    logger.info("Password reset", { userId: user.id });

    ApiResponse.success(res, null, "Password reset successfully");
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
      .createHash("sha256")
      .update(data.token)
      .digest("hex");

    // Find user with valid token
    const userResult = await query<UserRow>(
      "SELECT * FROM users WHERE email_verification_token = $1 AND email_verification_expires > $2",
      [hashedToken, new Date()]
    );

    if (userResult.rows.length === 0) {
      throw ApiError.badRequest("Invalid or expired verification token");
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

    logger.info("Email verified", { userId: user.id });

    ApiResponse.success(res, null, "Email verified successfully");
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
      await query("UPDATE users SET refresh_token = NULL WHERE id = $1", [
        userId,
      ]);
      logger.info("User logged out", { userId });
    }

    ApiResponse.success(res, null, "Logged out successfully");
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

    // Check cache first (10 second TTL for user profile)
    const { cache } = await import('../services/cache.service.js');
    const cacheKey = `user:profile:${userId}`;
    const cached = cache.get<{ user: ReturnType<typeof getPublicProfile> }>(cacheKey);
    
    if (cached) {
      ApiResponse.success(res, cached);
      return;
    }

    const userResult = await query<UserRow>(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) throw ApiError.notFound("User not found");

    const user = mapUserRow(userResult.rows[0]);
    const responseData = {
      user: getPublicProfile(user),
    };
    
    // Cache the response for 10 seconds
    cache.set(cacheKey, responseData, 10);

    ApiResponse.success(res, responseData);
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
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) throw ApiError.notFound("User not found");

    const user = mapUserRow(userResult.rows[0]);

    const consentsResult = await query<ConsentRow>(
      "SELECT * FROM consent_records WHERE user_id = $1",
      [userId]
    );
    const consents = consentsResult.rows;

    const whatsAppResult = await query<WhatsAppRow>(
      "SELECT * FROM whatsapp_enrollments WHERE user_id = $1",
      [userId]
    );
    const whatsApp = whatsAppResult.rows[0];

    const hasTerms = hasConsent(consents, "terms_of_service");
    const hasPrivacy = hasConsent(consents, "privacy_policy");

    const status = {
      currentStep: user.onboardingStatus,
      steps: {
        registered: true,
        consent: hasTerms && hasPrivacy,
        whatsApp: whatsApp?.is_verified || false,
        assessment:
          user.onboardingStatus !== "registered" &&
          user.onboardingStatus !== "consent_pending" &&
          user.onboardingStatus !== "assessment_pending",
        goals: [
          "goals_pending",
          "preferences_pending",
          "plan_pending",
          "completed",
        ].includes(user.onboardingStatus),
        preferences: [
          "preferences_pending",
          "plan_pending",
          "completed",
        ].includes(user.onboardingStatus),
        plan: user.onboardingStatus === "completed",
      },
      isComplete: user.onboardingStatus === "completed",
      completedAt: user.onboardingCompletedAt,
    };

    ApiResponse.success(res, status);
  }
);

/**
 * Resend Registration OTP
 * POST /api/auth/resend-registration-otp
 *
 * Decodes the activation token, generates a new OTP, and sends it to the user's email.
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
      throw ApiError.badRequest("Session expired. Please register again.");
    }

    const userData = decoded.user;

    // Check if email was already registered
    const existingResult = await query<UserRow>(
      "SELECT id FROM users WHERE email = $1",
      [userData.email]
    );

    if (existingResult.rows.length > 0) {
      throw ApiError.conflict(
        "This email is already registered. Sign in or reset password?"
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
      { expiresIn: "10m" }
    );

    // Send new OTP email
    await mailHelper.sendRegistrationOTPEmail(
      userData.email,
      userData.firstName,
      activationCode,
      "10 minutes"
    );

    logger.info("Registration OTP resent", { email: userData.email });

    ApiResponse.success(
      res,
      {
        activationToken: newToken,
        message: "New verification code sent to your email",
      },
      "Please check your email for the new verification code"
    );
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
      throw ApiError.badRequest("No fields to update");
    }

    // Add updated_at and user id
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query<UserRow>(updateQuery, values);

    if (result.rows.length === 0) {
      throw ApiError.notFound("User not found");
    }

    const user = mapUserRow(result.rows[0]);

    logger.info("Profile updated", { userId });

    ApiResponse.success(
      res,
      {
        user: getPublicProfile(user),
      },
      "Profile updated successfully"
    );
  }
);

export default {
  register,
  verifyRegistration,
  resendRegistrationOTP,
  socialAuth,
  completeSocialProfile,
  submitConsent,
  enrollWhatsApp,
  verifyWhatsApp,
  skipWhatsApp,
  login,
  forgotPassword,
  resetPassword,
  verifyEmail,
  logout,
  getCurrentUser,
  getOnboardingStatus,
  updateProfile,
};
