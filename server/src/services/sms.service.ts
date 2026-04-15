import crypto from "crypto";
import { env } from "../config/env.config.js";
import { logger } from "./logger.service.js";

interface SendSMSOptions {
  to: string;
  message: string;
}

interface VerificationCode {
  code: string;
  expiresAt: Date;
  attempts: number;
}

class SMSService {
  private static instance: SMSService;
  private verificationCodes: Map<string, VerificationCode> = new Map();
  private readonly codeExpiry = 10 * 60 * 1000;
  private readonly maxAttempts = 3;

  private constructor() {}

  public static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  /**
   * Generate a 6-digit verification code
   */
  private generateCode(): string {
    const code = crypto.randomInt(100000, 999999).toString();
    return code;
  }

  /**
   * Format phone number to E.164 format
   */
  private formatPhoneNumber(phone: string, countryCode: string): string {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, "");

    // Add country code if not present
    if (!cleaned.startsWith(countryCode.replace("+", ""))) {
      return `+${countryCode.replace("+", "")}${cleaned}`;
    }

    return `+${cleaned}`;
  }

  /**
   * Send SMS via Twilio (or mock in development)
   */
  private async sendSMS(options: SendSMSOptions): Promise<boolean> {
    const { to, message } = options;

    // In development, just log the message
    if (env.isDevelopment || env.isTest) {
      logger.info("SMS (Development Mode)", { to, message });
      return true;
    }

    // Production: Use Twilio
    try {
      // TODO: Integrate with Twilio
      // const twilioClient = require('twilio')(env.twilio.accountSid, env.twilio.authToken);
      // await twilioClient.messages.create({
      //   body: message,
      //   from: env.twilio.phoneNumber,
      //   to: to,
      // });

      logger.info("SMS sent", { to });
      return true;
    } catch (error) {
      logger.error("Failed to send SMS", {
        error: error instanceof Error ? error.message : "Unknown error",
        to,
      });
      return false;
    }
  }

  /**
   * Send verification code to phone number
   */
  public async sendVerificationCode(
    phoneNumber: string,
    countryCode: string
  ): Promise<{ success: boolean; expiresIn: number; message?: string }> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber, countryCode);
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.codeExpiry);

    // Store the verification code
    this.verificationCodes.set(formattedPhone, {
      code,
      expiresAt,
      attempts: 0,
    });

    // Send SMS
    const message = `Your Balencia verification code is: ${code}. Valid for 10 minutes.`;
    const sent = await this.sendSMS({ to: formattedPhone, message });

    if (!sent) {
      this.verificationCodes.delete(formattedPhone);
      return {
        success: false,
        expiresIn: 0,
        message: "Couldn't verify number. Try again or skip for now.",
      };
    }

    logger.info("Verification code sent", {
      phone: formattedPhone.replace(/\d(?=\d{4})/g, "*"),
    });

    return {
      success: true,
      expiresIn: this.codeExpiry / 1000, // seconds
    };
  }

  /**
   * Verify the code entered by user
   */
  public verifyCode(
    phoneNumber: string,
    countryCode: string,
    code: string
  ): { success: boolean; message?: string; attemptsRemaining?: number } {
    const formattedPhone = this.formatPhoneNumber(phoneNumber, countryCode);
    const stored = this.verificationCodes.get(formattedPhone);

    if (!stored) {
      return {
        success: false,
        message: "No verification code found. Please request a new one.",
      };
    }

    // Check expiry
    if (new Date() > stored.expiresAt) {
      this.verificationCodes.delete(formattedPhone);
      return {
        success: false,
        message: "Verification code has expired. Please request a new one.",
      };
    }

    // Check attempts
    if (stored.attempts >= this.maxAttempts) {
      this.verificationCodes.delete(formattedPhone);
      return {
        success: false,
        message: "Too many attempts. Please request a new verification code.",
        attemptsRemaining: 0,
      };
    }

    // Verify code
    if (stored.code !== code) {
      stored.attempts++;
      const attemptsRemaining = this.maxAttempts - stored.attempts;

      if (attemptsRemaining === 0) {
        this.verificationCodes.delete(formattedPhone);
        return {
          success: false,
          message: "Incorrect code. Please request a new verification code.",
          attemptsRemaining: 0,
        };
      }

      return {
        success: false,
        message: `Incorrect code. ${attemptsRemaining} attempts remaining.`,
        attemptsRemaining,
      };
    }

    // Success - remove the code
    this.verificationCodes.delete(formattedPhone);

    logger.info("Phone verified", {
      phone: formattedPhone.replace(/\d(?=\d{4})/g, "*"),
    });

    return { success: true };
  }

  /**
   * Resend verification code
   */
  public async resendVerificationCode(
    phoneNumber: string,
    countryCode: string
  ): Promise<{ success: boolean; expiresIn: number; message?: string }> {
    const formattedPhone = this.formatPhoneNumber(phoneNumber, countryCode);

    // Check if there's an existing code that was sent recently (rate limiting)
    const existing = this.verificationCodes.get(formattedPhone);
    if (existing) {
      const timeElapsed =
        Date.now() - (existing.expiresAt.getTime() - this.codeExpiry);
      if (timeElapsed < 60000) {
        // 1 minute cooldown
        return {
          success: false,
          expiresIn: 0,
          message: "Please wait before requesting a new code.",
        };
      }
    }

    // Delete existing code and send new one
    this.verificationCodes.delete(formattedPhone);
    return this.sendVerificationCode(phoneNumber, countryCode);
  }

  /**
   * Clean up expired codes (called periodically)
   */
  public cleanupExpiredCodes(): void {
    const now = new Date();
    for (const [phone, data] of this.verificationCodes.entries()) {
      if (now > data.expiresAt) {
        this.verificationCodes.delete(phone);
      }
    }
  }
}

export const smsService = SMSService.getInstance();
export default smsService;
