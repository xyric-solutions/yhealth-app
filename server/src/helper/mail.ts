import ejs from 'ejs';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { env } from '../config/env.config.js';
import { logger } from '../services/logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to EJS templates - check multiple locations for Docker compatibility
// In Docker: compiled JS is at /app/dist/server/src/helper/ but templates are at /app/src/mails/
function resolveTemplatesPath(): string {
  // Explicit env var takes precedence (set in Docker/Railway)
  if (process.env['EMAIL_TEMPLATES_PATH']) {
    return process.env['EMAIL_TEMPLATES_PATH'];
  }
  const candidates = [
    join(__dirname, '../mails'),       // relative to compiled JS (works in dev and if templates copied to dist/)
    join(process.cwd(), 'src/mails'),  // relative to working dir (Docker: /app/src/mails)
    join(process.cwd(), 'server/src/mails'), // from project root (dev mode)
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0]; // fallback
}
const TEMPLATES_PATH = resolveTemplatesPath();
logger.info(`[Mail] Templates path resolved to: ${TEMPLATES_PATH}`);

/**
 * Email subject lines for each template type
 */
export const EMAIL_SUBJECTS = {
  'verification': 'Verify Your Email - Balencia',
  'resend-verification': 'New Verification Link - Balencia',
  'email-verified': 'Email Verified! - Balencia',
  'password-reset': 'Reset Your Password - Balencia',
  'password-changed': 'Password Changed - Balencia',
  'password-reset-otp': 'Your Password Reset Code - Balencia',
  'registration-otp': 'Your Verification Code - Balencia',
  'security-alert': 'Security Alert - Balencia',
  'welcome': 'Welcome to Balencia - Your AI Life Coach!',
  'assessment-reminder': 'Complete Your Assessment - Balencia',
  'integration-reminder': 'Connect Your Devices - Balencia',
  'goal-set': 'Goal Set! - Balencia',
  'onboarding-complete': "You're All Set! - Balencia",
  'weekly-progress': 'Your Weekly Progress - Balencia',
  'milestone-achieved': 'Milestone Achieved! - Balencia',
  'streak-milestone': 'Streak Milestone! - Balencia',
  're-engagement': 'We Miss You! - Balencia',
  'task-reminder': 'Task Reminder - Balencia',
  'contact-confirmation': 'We Received Your Message - Balencia',
  'contact-admin-note': 'Update on Your Inquiry - Balencia',
  'subscription-confirmation': 'You\'re In! Your Balencia Subscription is Active',
  'subscription-invoice': 'Your Balencia Invoice is Ready',
  // Email engine templates
  'coachingInsight': 'A Message from Your AI Coach - Balencia',
  'digestSummary': 'Your Weekly Summary - Balencia',
} as const;

export type EmailTemplateType = keyof typeof EMAIL_SUBJECTS;

/**
 * Options for sending email
 */
export interface SendMailOptions {
  email: string | string[];
  subject: string;
  template?: string;
  html?: string;
  text?: string;
  data?: Record<string, unknown>;
  fromName?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

/**
 * Public interface for MailHelper
 */
export interface IMailHelper {
  send(options: SendMailOptions): Promise<boolean>;
  verify(): Promise<boolean>;
  healthCheck(): Promise<{ status: 'up' | 'down'; message?: string }>;
  isMailConfigured(): boolean;
  getAppUrl(): string;
  sendVerificationEmail(email: string, firstName: string, verificationToken: string): Promise<boolean>;
  resendVerificationEmail(email: string, firstName: string, verificationToken: string): Promise<boolean>;
  sendEmailVerifiedEmail(email: string, firstName: string): Promise<boolean>;
  sendPasswordResetEmail(email: string, firstName: string, resetToken: string, ipAddress?: string): Promise<boolean>;
  sendPasswordResetOTPEmail(email: string, firstName: string, otpCode: string, expiresIn?: string): Promise<boolean>;
  sendRegistrationOTPEmail(email: string, firstName: string, otpCode: string, expiresIn?: string): Promise<boolean>;
  sendPasswordChangedEmail(email: string, firstName: string, ipAddress?: string, device?: string): Promise<boolean>;
  sendSecurityAlertEmail(email: string, firstName: string, alertType: string, ipAddress?: string, location?: string, device?: string): Promise<boolean>;
  sendWelcomeEmail(email: string, firstName: string): Promise<boolean>;
  sendAssessmentReminderEmail(email: string, firstName: string, daysRegistered: number): Promise<boolean>;
  sendIntegrationReminderEmail(email: string, firstName: string, connectedCount: number, availableIntegrations?: string[]): Promise<boolean>;
  sendGoalSetEmail(email: string, firstName: string, goalTitle: string, goalCategory: string): Promise<boolean>;
  sendOnboardingCompleteEmail(email: string, firstName: string, connectedDevices?: number, goalsSet?: number): Promise<boolean>;
  sendWeeklyProgressEmail(email: string, firstName: string, data: {
    weekStart: string;
    weekEnd: string;
    checkIns?: number;
    goalsProgress?: number;
    streak?: number;
    coachMessage?: string;
    highlights?: Array<{ icon?: string; title: string; description: string }>;
    insights?: string[];
    nextWeekFocus?: string;
  }): Promise<boolean>;
  sendMilestoneAchievedEmail(email: string, firstName: string, data: {
    milestoneTitle: string;
    milestoneDescription: string;
    milestoneCategory: string;
    milestoneIcon?: string;
    stats?: {
      daysActive?: number;
      totalCheckIns?: number;
      goalsCompleted?: number;
    };
  }): Promise<boolean>;
  sendStreakMilestoneEmail(email: string, firstName: string, streakDays: number, nextMilestone?: number, motivationalQuote?: string, quoteAuthor?: string): Promise<boolean>;
  sendReEngagementEmail(email: string, firstName: string, daysAway: number, lastActivity?: string, newFeatures?: string[]): Promise<boolean>;
  sendContactConfirmationEmail(email: string, name: string, subject: string, message: string, dashboardUrl?: string, helpUrl?: string): Promise<boolean>;
  sendContactAdminNoteEmail(email: string, name: string, subject: string, message: string, adminNote: string, adminName?: string, adminRole?: string, status?: string, dashboardUrl?: string, contactUrl?: string): Promise<boolean>;
  sendContactReplyEmail(email: string, name: string, originalSubject: string, replyMessage: string, adminName?: string, adminEmail?: string): Promise<boolean>;
  sendSubscriptionConfirmationEmail(
    email: string,
    firstName: string,
    data: {
      planName: string;
      amountFormatted: string;
      interval: string;
      periodEnd: string;
      manageSubscriptionUrl: string;
      invoiceUrl?: string;
    }
  ): Promise<boolean>;
  sendSubscriptionInvoiceEmail(
    email: string,
    firstName: string,
    data: { amountFormatted: string; invoiceUrl: string; invoiceNumber?: string; date?: string }
  ): Promise<boolean>;
}

/**
 * Mail Helper - Centralized email sending utility for Balencia
 * Uses EJS templates for rendering beautiful, responsive emails
 */
class MailHelper {
  private static instance: MailHelper;
  private transporter: Transporter | null = null;
  private readonly isConfigured: boolean;
  private readonly appUrl: string;

  private constructor() {
    this.isConfigured = !!(env.smtp.host && env.smtp.user && env.smtp.pass);
    this.appUrl = process.env['APP_URL'] || 'http://localhost:3000';

    if (this.isConfigured) {
      this.createTransporter();
      logger.info(`Mail helper configured (SMTP: ${env.smtp.host}, forceEmailInDev: ${env.forceEmailInDev})`);
    } else {
      logger.warn('Mail helper not configured - SMTP credentials missing');
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MailHelper {
    if (!MailHelper.instance) {
      MailHelper.instance = new MailHelper();
    }
    return MailHelper.instance;
  }

  /**
   * Create nodemailer transporter with connection pooling
   */
  private createTransporter(): void {
    try {
      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.pass,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10,
        // Add connection timeout and retry options
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      logger.info('Mail transporter created', {
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        user: env.smtp.user ? `${env.smtp.user.substring(0, 3)}***` : 'not set',
      });

      // Verify connection asynchronously in production only.
      // In development, SMTP is often unreachable (firewalls, VPNs) and the
      // timeout just adds noise to the logs. Emails will still fail gracefully
      // at send-time if the connection is bad.
      if (env.isProduction) {
        this.verify().catch((verifyError) => {
          logger.warn('Mail transporter verification failed on startup', {
            error: verifyError instanceof Error ? verifyError.message : 'Unknown error',
            hint: 'This may indicate SMTP credentials are incorrect. Emails may fail to send.',
          });
        });
      } else {
        logger.info('Mail transporter created (skipping verification in development)');
      }
    } catch (error) {
      logger.error('Failed to create mail transporter', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Render EJS template with data
   */
  private async renderTemplate(
    templateName: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const templatePath = templateName.endsWith('.ejs')
      ? join(TEMPLATES_PATH, templateName)
      : join(TEMPLATES_PATH, `${templateName}.ejs`);
    return ejs.renderFile(templatePath, data);
  }

  /**
   * Verify transporter connection
   */
  public async verify(): Promise<boolean> {
    if (!this.transporter) {
      logger.warn('Mail transporter not initialized - cannot verify');
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('Mail service verified successfully', {
        host: env.smtp.host,
        port: env.smtp.port,
      });
      return true;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      const errorCode = error?.code || error?.responseCode;
      
      const isAuthError = 
        errorMessage.includes('Invalid login') ||
        errorMessage.includes('Username and Password not accepted') ||
        errorMessage.includes('535') ||
        errorMessage.includes('Authentication failed') ||
        errorCode === 'EAUTH' ||
        errorCode === 535;

      if (isAuthError) {
        logger.error('Mail service verification failed - SMTP authentication error', {
          error: errorMessage,
          errorCode,
          smtpHost: env.smtp.host,
          smtpUser: env.smtp.user ? `${env.smtp.user.substring(0, 3)}***` : 'not set',
          hint: 'For Gmail: Ensure you are using an App Password (not regular password) if 2FA is enabled. ' +
                'Check SMTP_USER and SMTP_PASS environment variables. ' +
                'See: https://support.google.com/accounts/answer/185833',
        });
      } else {
        logger.error('Mail service verification failed', {
          error: errorMessage,
          errorCode,
          errorStack: error?.stack,
          smtpHost: env.smtp.host,
          smtpPort: env.smtp.port,
        });
      }
      return false;
    }
  }

  /**
   * Send email - Core method
   */
  public async send(options: SendMailOptions): Promise<boolean> {
    if (!this.transporter || !this.isConfigured) {
      logger.warn('Email not sent - service not configured', {
        to: options.email,
        subject: options.subject,
      });
      return false;
    }

    // In development, log email details instead of sending via SMTP
    // unless FORCE_EMAIL_IN_DEV is enabled in .env
    if (!env.isProduction && !env.forceEmailInDev) {
      logger.info('[DEV] Email would be sent (SMTP bypassed). Set FORCE_EMAIL_IN_DEV=true in .env and restart server to send.', {
        to: options.email,
        subject: options.subject,
        template: options.template,
        forceEmailInDev: env.forceEmailInDev,
        ...(options.data && { data: options.data }),
      });
      return true;
    }

    try {
      const { email, subject, template, html: providedHtml, text, data, fromName = 'Balencia', attachments } = options;

      if (!email || !subject) {
        throw new Error('Missing required email parameters: email or subject');
      }

      let html: string;
      if (providedHtml) {
        html = providedHtml;
      } else if (template) {
        html = await this.renderTemplate(template, { subject, ...data });
      } else {
        throw new Error('Either template or html must be provided');
      }

      const mailOptions = {
        from: `${fromName} <${env.smtp.from || env.smtp.user}>`,
        to: Array.isArray(email) ? email.join(', ') : email,
        subject,
        html,
        ...(text && { text }),
        ...(attachments && {
          attachments: attachments.map(att => ({
            filename: att.filename,
            ...(att.content && { content: att.content }),
            ...(att.path && { path: att.path }),
            ...(att.contentType && { contentType: att.contentType }),
          })),
        }),
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: email,
        subject,
      });

      return true;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      const errorCode = error?.code || error?.responseCode;
      
      // Check for SMTP authentication errors
      const isAuthError = 
        errorMessage.includes('Invalid login') ||
        errorMessage.includes('Username and Password not accepted') ||
        errorMessage.includes('535') ||
        errorMessage.includes('Authentication failed') ||
        errorCode === 'EAUTH' ||
        errorCode === 535;

      if (isAuthError) {
        logger.error('SMTP authentication failed - check credentials', {
          error: errorMessage,
          errorCode,
          smtpHost: env.smtp.host,
          smtpUser: env.smtp.user ? `${env.smtp.user.substring(0, 3)}***` : 'not set',
          to: options.email,
          subject: options.subject,
          template: options.template,
          hint: 'For Gmail: Use App Password if 2FA is enabled. Check SMTP_USER and SMTP_PASS environment variables.',
        });
      } else {
        logger.error('Failed to send email', {
          error: errorMessage,
          errorCode,
          errorStack: error?.stack,
          to: options.email,
          subject: options.subject,
          template: options.template,
        });
      }

      return false;
    }
  }

  // ============================================
  // VERIFICATION EMAILS
  // ============================================

  /**
   * Send email verification
   */
  public async sendVerificationEmail(
    email: string,
    firstName: string,
    verificationToken: string
  ): Promise<boolean> {
    const verificationUrl = `${this.appUrl}/verify-email?token=${verificationToken}`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['verification'],
      template: 'emailVerification',
      data: { firstName, verificationUrl },
    });
  }

  /**
   * Resend verification email
   */
  public async resendVerificationEmail(
    email: string,
    firstName: string,
    verificationToken: string
  ): Promise<boolean> {
    const verificationUrl = `${this.appUrl}/verify-email?token=${verificationToken}`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['resend-verification'],
      template: 'resendVerification',
      data: { firstName, verificationUrl },
    });
  }

  /**
   * Send email verified confirmation
   */
  public async sendEmailVerifiedEmail(
    email: string,
    firstName: string
  ): Promise<boolean> {
    const dashboardUrl = `${this.appUrl}/dashboard`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['email-verified'],
      template: 'emailVerified',
      data: { firstName, dashboardUrl },
    });
  }

  // ============================================
  // PASSWORD EMAILS
  // ============================================

  /**
   * Send password reset email
   */
  public async sendPasswordResetEmail(
    email: string,
    firstName: string,
    resetToken: string,
    ipAddress?: string
  ): Promise<boolean> {
    const resetUrl = `${this.appUrl}/reset-password?token=${resetToken}`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['password-reset'],
      template: 'passwordReset',
      data: { firstName, resetUrl, ipAddress },
    });
  }

  /**
   * Send password reset OTP email
   */
  public async sendPasswordResetOTPEmail(
    email: string,
    firstName: string,
    otpCode: string,
    expiresIn: string = '10 minutes'
  ): Promise<boolean> {
    return this.send({
      email,
      subject: EMAIL_SUBJECTS['password-reset-otp'],
      template: 'passwordResetOTP',
      data: { firstName, otpCode, expiresIn },
    });
  }

  /**
   * Send registration OTP email for account verification
   */
  public async sendRegistrationOTPEmail(
    email: string,
    firstName: string,
    otpCode: string,
    expiresIn: string = '10 minutes'
  ): Promise<boolean> {
    return this.send({
      email,
      subject: EMAIL_SUBJECTS['registration-otp'],
      template: 'registrationOTP',
      data: { firstName, otpCode, expiresIn },
    });
  }

  /**
   * Send password changed confirmation
   */
  public async sendPasswordChangedEmail(
    email: string,
    firstName: string,
    ipAddress?: string,
    device?: string
  ): Promise<boolean> {
    const dashboardUrl = `${this.appUrl}/dashboard`;
    const resetUrl = `${this.appUrl}/forgot-password`;
    const changedAt = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['password-changed'],
      template: 'passwordChanged',
      data: { firstName, changedAt, ipAddress, device, dashboardUrl, resetUrl },
    });
  }

  /**
   * Send security alert email
   */
  public async sendSecurityAlertEmail(
    email: string,
    firstName: string,
    alertType: string,
    ipAddress?: string,
    location?: string,
    device?: string
  ): Promise<boolean> {
    const secureAccountUrl = `${this.appUrl}/settings/security`;
    const activityTime = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['security-alert'],
      template: 'securityAlert',
      data: { firstName, alertType, activityTime, ipAddress, location, device, secureAccountUrl },
    });
  }

  // ============================================
  // WELCOME & ONBOARDING EMAILS
  // ============================================

  /**
   * Send welcome email
   */
  public async sendWelcomeEmail(
    email: string,
    firstName: string
  ): Promise<boolean> {
    const dashboardUrl = `${this.appUrl}/dashboard`;
    const assessmentUrl = `${this.appUrl}/onboarding/assessment`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['welcome'],
      template: 'welcome',
      data: { firstName, dashboardUrl, assessmentUrl },
    });
  }

  /**
   * Send assessment reminder
   */
  public async sendAssessmentReminderEmail(
    email: string,
    firstName: string,
    daysRegistered: number
  ): Promise<boolean> {
    const assessmentUrl = `${this.appUrl}/onboarding/assessment`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['assessment-reminder'],
      template: 'assessmentReminder',
      data: { firstName, assessmentUrl, daysRegistered },
    });
  }

  /**
   * Send integration reminder
   */
  public async sendIntegrationReminderEmail(
    email: string,
    firstName: string,
    connectedCount: number,
    availableIntegrations: string[] = ['WHOOP', 'Fitbit', 'Garmin', 'Oura']
  ): Promise<boolean> {
    const integrationsUrl = `${this.appUrl}/onboarding/integrations`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['integration-reminder'],
      template: 'integrationReminder',
      data: { firstName, integrationsUrl, connectedCount, availableIntegrations },
    });
  }

  /**
   * Send goal set celebration
   */
  public async sendGoalSetEmail(
    email: string,
    firstName: string,
    goalTitle: string,
    goalCategory: string
  ): Promise<boolean> {
    const dashboardUrl = `${this.appUrl}/dashboard`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['goal-set'],
      template: 'goalSet',
      data: { firstName, goalTitle, goalCategory, dashboardUrl },
    });
  }

  /**
   * Send onboarding complete email
   */
  public async sendOnboardingCompleteEmail(
    email: string,
    firstName: string,
    connectedDevices?: number,
    goalsSet?: number
  ): Promise<boolean> {
    const dashboardUrl = `${this.appUrl}/dashboard`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['onboarding-complete'],
      template: 'onboardingComplete',
      data: { firstName, dashboardUrl, connectedDevices, goalsSet },
    });
  }

  // ============================================
  // PROGRESS & ENGAGEMENT EMAILS
  // ============================================

  /**
   * Send weekly progress summary
   */
  public async sendWeeklyProgressEmail(
    email: string,
    firstName: string,
    data: {
      weekStart: string;
      weekEnd: string;
      checkIns?: number;
      goalsProgress?: number;
      streak?: number;
      coachMessage?: string;
      highlights?: Array<{ icon?: string; title: string; description: string }>;
      insights?: string[];
      nextWeekFocus?: string;
    }
  ): Promise<boolean> {
    const dashboardUrl = `${this.appUrl}/dashboard`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['weekly-progress'],
      template: 'weeklyProgress',
      data: { firstName, dashboardUrl, ...data },
    });
  }

  /**
   * Send milestone achieved celebration
   */
  public async sendMilestoneAchievedEmail(
    email: string,
    firstName: string,
    data: {
      milestoneTitle: string;
      milestoneDescription: string;
      milestoneCategory: string;
      milestoneIcon?: string;
      stats?: {
        daysActive?: number;
        totalCheckIns?: number;
        goalsCompleted?: number;
      };
    }
  ): Promise<boolean> {
    const dashboardUrl = `${this.appUrl}/dashboard`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['milestone-achieved'],
      template: 'milestoneAchieved',
      data: { firstName, dashboardUrl, ...data },
    });
  }

  /**
   * Send streak milestone celebration
   */
  public async sendStreakMilestoneEmail(
    email: string,
    firstName: string,
    streakDays: number,
    nextMilestone?: number,
    motivationalQuote?: string,
    quoteAuthor?: string
  ): Promise<boolean> {
    const dashboardUrl = `${this.appUrl}/dashboard`;

    return this.send({
      email,
      subject: `${streakDays} Day Streak! - Balencia`,
      template: 'streakMilestone',
      data: { firstName, streakDays, dashboardUrl, nextMilestone, motivationalQuote, quoteAuthor },
    });
  }

  /**
   * Send re-engagement email for inactive users
   */
  public async sendReEngagementEmail(
    email: string,
    firstName: string,
    daysAway: number,
    lastActivity?: string,
    newFeatures?: string[]
  ): Promise<boolean> {
    const dashboardUrl = `${this.appUrl}/dashboard`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['re-engagement'],
      template: 'reEngagement',
      data: { firstName, daysAway, dashboardUrl, lastActivity, newFeatures },
    });
  }

  // ============================================
  // CONTACT EMAILS
  // ============================================

  /**
   * Send contact form submission confirmation email
   */
  public async sendContactConfirmationEmail(
    email: string,
    name: string,
    subject: string,
    message: string,
    dashboardUrl?: string,
    helpUrl?: string
  ): Promise<boolean> {
    const appDashboardUrl = dashboardUrl || `${this.appUrl}/dashboard`;
    const appHelpUrl = helpUrl || `${this.appUrl}/help`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['contact-confirmation'],
      template: 'contactConfirmation',
      data: { name, email, subject, message, dashboardUrl: appDashboardUrl, helpUrl: appHelpUrl },
    });
  }

  /**
   * Send admin note notification email to user
   */
  public async sendContactAdminNoteEmail(
    email: string,
    name: string,
    subject: string,
    message: string,
    adminNote: string,
    adminName?: string,
    adminRole?: string,
    status?: string,
    dashboardUrl?: string,
    contactUrl?: string
  ): Promise<boolean> {
    const appDashboardUrl = dashboardUrl || `${this.appUrl}/dashboard`;
    const appContactUrl = contactUrl || `${this.appUrl}/contact`;

    return this.send({
      email,
      subject: EMAIL_SUBJECTS['contact-admin-note'],
      template: 'contactAdminNote',
      data: {
        name,
        email,
        subject,
        message,
        adminNote,
        adminName,
        adminRole,
        status,
        dashboardUrl: appDashboardUrl,
        contactUrl: appContactUrl,
      },
    });
  }

  /**
   * Send reply email to contact submission user
   */
  public async sendContactReplyEmail(
    email: string,
    name: string,
    originalSubject: string,
    replyMessage: string,
    adminName?: string,
    adminEmail?: string
  ): Promise<boolean> {
    const subject = `Re: ${originalSubject}`;

    // Create a simple HTML email for the reply
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1F2937; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #A855F7 100%); padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #FFFFFF; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .message { background: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0; white-space: pre-wrap; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #FFFFFF; margin: 0; font-size: 24px;">Balencia Support</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <div class="message">${replyMessage.replace(/\n/g, '<br>')}</div>
            ${adminName ? `<p style="margin-top: 20px; color: #6B7280; font-size: 14px;">Best regards,<br><strong>${adminName}</strong><br>Balencia Support Team</p>` : '<p style="margin-top: 20px; color: #6B7280; font-size: 14px;">Best regards,<br>Balencia Support Team</p>'}
            <div class="footer">
              <p>This is a reply to your inquiry: <strong>${originalSubject}</strong></p>
              ${adminEmail ? `<p>You can reply directly to this email or contact us at ${adminEmail}</p>` : ''}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      email,
      subject,
      html,
      fromName: adminName || 'Balencia Support',
    });
  }

  // ============================================
  // SUBSCRIPTION & INVOICE EMAILS
  // ============================================

  /**
   * Send subscription confirmation email (modern responsive template)
   */
  public async sendSubscriptionConfirmationEmail(
    email: string,
    firstName: string,
    data: {
      planName: string;
      amountFormatted: string;
      interval: string;
      periodEnd: string;
      manageSubscriptionUrl: string;
      invoiceUrl?: string;
    }
  ): Promise<boolean> {
    const { planName, amountFormatted, interval, periodEnd, manageSubscriptionUrl, invoiceUrl } = data;
    const html = this.getSubscriptionConfirmationHtml(firstName, planName, amountFormatted, interval, periodEnd, manageSubscriptionUrl, invoiceUrl);
    return this.send({
      email,
      subject: EMAIL_SUBJECTS['subscription-confirmation'],
      html,
      fromName: 'Balencia',
    });
  }

  /**
   * Send subscription invoice email (responsive template with invoice link)
   */
  public async sendSubscriptionInvoiceEmail(
    email: string,
    firstName: string,
    data: { amountFormatted: string; invoiceUrl: string; invoiceNumber?: string; date?: string }
  ): Promise<boolean> {
    const { amountFormatted, invoiceUrl, invoiceNumber, date } = data;
    const html = this.getSubscriptionInvoiceHtml(firstName, amountFormatted, invoiceUrl, invoiceNumber, date);
    return this.send({
      email,
      subject: EMAIL_SUBJECTS['subscription-invoice'],
      html,
      fromName: 'Balencia',
    });
  }

  /**
   * Build responsive subscription confirmation email HTML
   */
  private getSubscriptionConfirmationHtml(
    firstName: string,
    planName: string,
    amountFormatted: string,
    interval: string,
    periodEnd: string,
    manageSubscriptionUrl: string,
    invoiceUrl?: string
  ): string {
    const intervalLabel = interval === 'year' ? 'year' : 'month';
    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your subscription is active - Balencia</title>
  <style>
    body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f0fdf4;" width="100%">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f0fdf4;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="container" style="max-width:600px; margin:0 auto;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 0 0 24px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="font-size:28px; font-weight:800; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    <span style="color:#059669;">y</span><span style="color:#1f2937;">Health</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:11px; color:#6b7280; letter-spacing:2px; text-transform:uppercase; padding-top:4px;">Your AI Life Coach</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td class="mobile-pad" style="padding: 0 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#ffffff; border-radius:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
                <!-- Gradient bar -->
                <tr>
                  <td style="height:6px; background:linear-gradient(90deg,#059669 0%,#10b981 50%,#34d399 100%); border-radius:16px 16px 0 0;"></td>
                </tr>
                <tr>
                  <td style="padding: 40px 40px 32px 40px;">
                    <!-- Success icon -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom:24px;">
                      <tr>
                        <td align="center">
                          <div style="width:72px; height:72px; background:linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%); border-radius:50%; line-height:72px; text-align:center; font-size:36px;">✓</div>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1f2937; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; text-align:center;">You're all set, ${firstName}!</h1>
                    <p style="margin:0 0 28px 0; font-size:16px; line-height:26px; color:#4b5563; text-align:center;">Your Balencia subscription is now active.</p>
                    <!-- Plan summary box -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f0fdf4; border-radius:12px; border:1px solid #a7f3d0;">
                      <tr>
                        <td style="padding:24px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="font-size:12px; color:#047857; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Plan</td>
                              <td align="right" style="font-size:16px; font-weight:700; color:#1f2937;">${planName}</td>
                            </tr>
                            <tr><td colspan="2" style="height:12px;"></td></tr>
                            <tr>
                              <td style="font-size:12px; color:#047857; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Amount</td>
                              <td align="right" style="font-size:18px; font-weight:700; color:#059669;">${amountFormatted}<span style="font-size:14px; font-weight:500; color:#6b7280;">/${intervalLabel}</span></td>
                            </tr>
                            <tr><td colspan="2" style="height:12px;"></td></tr>
                            <tr>
                              <td style="font-size:12px; color:#047857; font-weight:600; text-transform:uppercase; letter-spacing:1px;">Next billing date</td>
                              <td align="right" style="font-size:15px; color:#374151;">${periodEnd}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <!-- CTAs -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:28px;">
                      <tr>
                        <td align="center">
                          <a href="${manageSubscriptionUrl}" target="_blank" style="display:inline-block; padding:16px 32px; background:linear-gradient(135deg,#059669 0%,#10b981 100%); color:#ffffff !important; font-size:16px; font-weight:600; text-decoration:none; border-radius:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Manage subscription</a>
                        </td>
                      </tr>
                      ${invoiceUrl ? `
                      <tr><td style="height:12px;"></td></tr>
                      <tr>
                        <td align="center">
                          <a href="${invoiceUrl}" target="_blank" style="display:inline-block; padding:12px 24px; background:#f3f4f6; color:#374151; font-size:14px; font-weight:600; text-decoration:none; border-radius:10px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View invoice</a>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 40px 40px 40px; border-top:1px solid #e5e7eb;">
                    <p style="margin:20px 0 0 0; font-size:13px; color:#9ca3af;">Questions? Reply to this email or visit our help center.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 24px;">
              <p style="margin:0; font-size:12px; color:#9ca3af;">Balencia by Xyric Solutions · Your AI Life Coach</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Build responsive invoice email HTML
   */
  private getSubscriptionInvoiceHtml(
    firstName: string,
    amountFormatted: string,
    invoiceUrl: string,
    invoiceNumber?: string,
    date?: string
  ): string {
    const displayDate = date || new Date().toLocaleDateString('en-US', { dateStyle: 'medium' });
    const displayNumber = invoiceNumber || '—';
    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your invoice - Balencia</title>
  <style>
    body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc;" width="100%">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="container" style="max-width:600px; margin:0 auto;">
          <tr>
            <td align="center" style="padding: 0 0 24px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="font-size:28px; font-weight:800; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    <span style="color:#059669;">y</span><span style="color:#1f2937;">Health</span>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:11px; color:#6b7280; letter-spacing:2px; text-transform:uppercase; padding-top:4px;">Your AI Life Coach</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="mobile-pad" style="padding: 0 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#ffffff; border-radius:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
                <tr>
                  <td style="height:6px; background:linear-gradient(90deg,#0ea5e9 0%,#06b6d4 100%); border-radius:16px 16px 0 0;"></td>
                </tr>
                <tr>
                  <td style="padding: 40px 40px 32px 40px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom:20px;">
                      <tr>
                        <td align="center">
                          <div style="width:64px; height:64px; background:linear-gradient(135deg,#e0f2fe 0%,#bae6fd 100%); border-radius:12px; line-height:64px; text-align:center; font-size:28px;">📄</div>
                        </td>
                      </tr>
                    </table>
                    <h1 style="margin:0 0 8px 0; font-size:22px; font-weight:700; color:#1f2937; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; text-align:center;">Your invoice is ready</h1>
                    <p style="margin:0 0 24px 0; font-size:16px; line-height:26px; color:#4b5563; text-align:center;">Hi ${firstName}, here are the details of your recent payment.</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
                      <tr>
                        <td style="padding:24px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="font-size:12px; color:#64748b; font-weight:600; text-transform:uppercase;">Invoice #</td>
                              <td align="right" style="font-size:15px; color:#1e293b; font-family:monospace;">${displayNumber}</td>
                            </tr>
                            <tr><td colspan="2" style="height:10px;"></td></tr>
                            <tr>
                              <td style="font-size:12px; color:#64748b; font-weight:600; text-transform:uppercase;">Date</td>
                              <td align="right" style="font-size:15px; color:#374151;">${displayDate}</td>
                            </tr>
                            <tr><td colspan="2" style="height:10px;"></td></tr>
                            <tr>
                              <td style="font-size:12px; color:#64748b; font-weight:600; text-transform:uppercase;">Amount paid</td>
                              <td align="right" style="font-size:20px; font-weight:700; color:#059669;">${amountFormatted}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:28px;">
                      <tr>
                        <td align="center">
                          <a href="${invoiceUrl}" target="_blank" style="display:inline-block; padding:16px 36px; background:linear-gradient(135deg,#0ea5e9 0%,#06b6d4 100%); color:#ffffff !important; font-size:16px; font-weight:600; text-decoration:none; border-radius:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">View & download invoice</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 40px 40px 40px; border-top:1px solid #e5e7eb;">
                    <p style="margin:20px 0 0 0; font-size:13px; color:#9ca3af;">This is a receipt for your subscription payment. For billing support, reply to this email.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 24px;">
              <p style="margin:0; font-size:12px; color:#9ca3af;">Balencia by Xyric Solutions</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ status: 'up' | 'down'; message?: string }> {
    if (!this.isConfigured) {
      return { status: 'down', message: 'Not configured' };
    }

    const verified = await this.verify();
    return verified
      ? { status: 'up' }
      : { status: 'down', message: 'Verification failed' };
  }

  /**
   * Check if mail service is configured
   */
  public isMailConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get app URL
   */
  public getAppUrl(): string {
    return this.appUrl;
  }
}

// Export singleton instance
export const mailHelper = MailHelper.getInstance();

// Export default for backward compatibility
export default mailHelper;

// Legacy function export for backward compatibility
export const sendMail = async (options: SendMailOptions): Promise<boolean> => {
  return mailHelper.send(options);
};
