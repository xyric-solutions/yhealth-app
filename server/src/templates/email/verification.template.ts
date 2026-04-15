/**
 * Email Verification Template
 * Sent when a new user registers to verify their email address
 */

import { baseEmailLayout, alertBox, BRAND_COLORS } from './base.template.js';

export interface VerificationEmailData {
  firstName: string;
  verificationUrl: string;
  expiresIn?: string;
}

export function emailVerificationTemplate(data: VerificationEmailData): string {
  const { firstName, verificationUrl, expiresIn = '24 hours' } = data;

  const content = `
    <p style="margin: 0 0 20px 0;">
      Thank you for joining <strong>Balencia</strong> - your personal AI Life Coach! We're excited to help you achieve your health and life goals.
    </p>

    <p style="margin: 0 0 20px 0;">
      To get started on your wellness journey, please verify your email address by clicking the button below:
    </p>

    ${alertBox('info', `This verification link will expire in <strong>${expiresIn}</strong>. If you didn't create an account with Balencia, you can safely ignore this email.`)}
  `;

  const secondaryContent = `
    <p style="margin: 0 0 12px 0;">
      <strong>Can't click the button?</strong> Copy and paste this link into your browser:
    </p>
    <p style="margin: 0; word-break: break-all; padding: 12px; background: ${BRAND_COLORS.gray100}; border-radius: 8px; font-family: monospace; font-size: 12px; color: ${BRAND_COLORS.gray600};">
      ${verificationUrl}
    </p>
  `;

  return baseEmailLayout({
    preheader: `Verify your email to start your wellness journey with Balencia - ${firstName}, we're excited to have you!`,
    title: 'Verify Your Email - Balencia',
    greeting: `Welcome, ${firstName}! `,
    content,
    ctaButton: {
      text: 'Verify My Email',
      url: verificationUrl,
    },
    secondaryContent,
    footer: {
      text: "Questions? Reply to this email or contact us at support@balencia.app - we're here to help!",
      showSocial: true,
      showUnsubscribe: false, // Don't show unsubscribe for transactional emails
    },
  });
}

/**
 * Resend verification email template
 */
export function resendVerificationTemplate(data: VerificationEmailData): string {
  const { firstName, verificationUrl, expiresIn = '24 hours' } = data;

  const content = `
    <p style="margin: 0 0 20px 0;">
      You requested a new verification link for your Balencia account. No worries - here's a fresh one!
    </p>

    <p style="margin: 0 0 20px 0;">
      Click the button below to verify your email and unlock your personal AI Life Coach:
    </p>

    ${alertBox('warning', `This is your new verification link. Previous links are now invalid. Link expires in <strong>${expiresIn}</strong>.`)}
  `;

  const secondaryContent = `
    <p style="margin: 0 0 12px 0;">
      <strong>Direct link:</strong>
    </p>
    <p style="margin: 0; word-break: break-all; padding: 12px; background: ${BRAND_COLORS.gray100}; border-radius: 8px; font-family: monospace; font-size: 12px; color: ${BRAND_COLORS.gray600};">
      ${verificationUrl}
    </p>
    <p style="margin: 16px 0 0 0; font-size: 13px;">
      If you didn't request this, please <a href="mailto:security@balencia.app" style="color: ${BRAND_COLORS.primary};">contact our security team</a>.
    </p>
  `;

  return baseEmailLayout({
    preheader: `New verification link for your Balencia account - ${firstName}, verify to continue`,
    title: 'New Verification Link - Balencia',
    greeting: `Hi ${firstName},`,
    content,
    ctaButton: {
      text: 'Verify Email Now',
      url: verificationUrl,
    },
    secondaryContent,
    footer: {
      showSocial: false,
      showUnsubscribe: false,
    },
  });
}

/**
 * Email verified success template
 */
export function emailVerifiedTemplate(firstName: string, dashboardUrl: string): string {
  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 80px; height: 80px; background: linear-gradient(135deg, ${BRAND_COLORS.secondary} 0%, #34D399 100%); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 40px; line-height: 80px;">&#10003;</span>
      </div>
    </div>

    <p style="margin: 0 0 20px 0; text-align: center; font-size: 18px;">
      Your email has been successfully verified! You're all set to start your journey with Balencia.
    </p>

    <p style="margin: 0 0 20px 0;">
      Here's what you can do next:
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td style="padding: 12px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="32" style="font-size: 20px; color: ${BRAND_COLORS.primary};">1</td>
              <td style="font-size: 15px; color: ${BRAND_COLORS.dark};"><strong>Complete your health assessment</strong> - Help us understand your goals</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="32" style="font-size: 20px; color: ${BRAND_COLORS.primary};">2</td>
              <td style="font-size: 15px; color: ${BRAND_COLORS.dark};"><strong>Connect your devices</strong> - Sync WHOOP, Fitbit, Garmin & more</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 12px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="32" style="font-size: 20px; color: ${BRAND_COLORS.primary};">3</td>
              <td style="font-size: 15px; color: ${BRAND_COLORS.dark};"><strong>Start chatting</strong> - Your AI coach is ready to help!</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return baseEmailLayout({
    preheader: `Email verified! Welcome to Balencia - Your AI Life Coach awaits, ${firstName}`,
    title: 'Email Verified - Balencia',
    greeting: `You're verified, ${firstName}!`,
    content,
    ctaButton: {
      text: 'Go to Dashboard',
      url: dashboardUrl,
      color: BRAND_COLORS.secondary,
    },
    footer: {
      showSocial: true,
      showUnsubscribe: false,
    },
  });
}

export default {
  emailVerificationTemplate,
  resendVerificationTemplate,
  emailVerifiedTemplate,
};
