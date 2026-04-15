/**
 * Password Reset Templates
 * Secure password reset flow emails
 */

import { baseEmailLayout, alertBox, codeBox, BRAND_COLORS } from './base.template.js';

export interface PasswordResetEmailData {
  firstName: string;
  resetUrl: string;
  expiresIn?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
}

/**
 * Password reset request email
 */
export function passwordResetTemplate(data: PasswordResetEmailData): string {
  const {
    firstName,
    resetUrl,
    expiresIn = '1 hour',
    ipAddress,
    timestamp = new Date().toLocaleString(),
  } = data;

  const content = `
    <p style="margin: 0 0 20px 0;">
      We received a request to reset the password for your Balencia account. If you made this request, click the button below to create a new password:
    </p>

    ${alertBox('warning', `
      <strong>Security Notice:</strong> This link expires in <strong>${expiresIn}</strong>.
      If you didn't request this reset, please ignore this email - your password will remain unchanged.
    `)}

    ${ipAddress ? `
    <div style="background: ${BRAND_COLORS.gray100}; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND_COLORS.gray500}; text-transform: uppercase; letter-spacing: 1px;">Request Details</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="font-size: 13px; color: ${BRAND_COLORS.gray600}; padding: 4px 0;">
            <strong>Time:</strong> ${timestamp}
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: ${BRAND_COLORS.gray600}; padding: 4px 0;">
            <strong>IP Address:</strong> ${ipAddress}
          </td>
        </tr>
      </table>
    </div>
    ` : ''}
  `;

  const secondaryContent = `
    <p style="margin: 0 0 12px 0;">
      <strong>Can't click the button?</strong> Copy this link:
    </p>
    <p style="margin: 0; word-break: break-all; padding: 12px; background: ${BRAND_COLORS.gray100}; border-radius: 8px; font-family: monospace; font-size: 11px; color: ${BRAND_COLORS.gray600};">
      ${resetUrl}
    </p>
    <p style="margin: 16px 0 0 0; font-size: 13px; color: ${BRAND_COLORS.gray500};">
      <strong>Didn't request this?</strong> If you didn't request a password reset, someone may be trying to access your account.
      <a href="mailto:security@balencia.app" style="color: ${BRAND_COLORS.primary};">Contact our security team</a> if you're concerned.
    </p>
  `;

  return baseEmailLayout({
    preheader: `Reset your Balencia password - This link expires in ${expiresIn}`,
    title: 'Password Reset Request - Balencia',
    greeting: `Hi ${firstName},`,
    content,
    ctaButton: {
      text: 'Reset My Password',
      url: resetUrl,
      color: '#EF4444', // Red for security-related action
    },
    secondaryContent,
    footer: {
      text: "If you're having trouble, contact us at security@balencia.app",
      showSocial: false,
      showUnsubscribe: false,
    },
  });
}

/**
 * Password changed confirmation email
 */
export function passwordChangedTemplate(data: {
  firstName: string;
  ipAddress?: string;
  timestamp?: string;
  securityUrl: string;
}): string {
  const {
    firstName,
    ipAddress,
    timestamp = new Date().toLocaleString(),
    securityUrl,
  } = data;

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 64px; height: 64px; background: ${BRAND_COLORS.secondary}; border-radius: 50%; margin: 0 auto; line-height: 64px;">
        <span style="font-size: 32px; color: white;">&#128274;</span>
      </div>
    </div>

    <p style="margin: 0 0 20px 0; text-align: center; font-size: 16px;">
      Your Balencia password has been successfully changed.
    </p>

    ${alertBox('success', 'Your account is now secured with your new password. You can sign in with your new credentials.')}

    <div style="background: ${BRAND_COLORS.gray100}; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND_COLORS.gray500}; text-transform: uppercase; letter-spacing: 1px;">Change Details</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="font-size: 13px; color: ${BRAND_COLORS.gray600}; padding: 4px 0;">
            <strong>Time:</strong> ${timestamp}
          </td>
        </tr>
        ${ipAddress ? `
        <tr>
          <td style="font-size: 13px; color: ${BRAND_COLORS.gray600}; padding: 4px 0;">
            <strong>IP Address:</strong> ${ipAddress}
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    ${alertBox('warning', `
      <strong>Wasn't you?</strong> If you didn't change your password, your account may be compromised.
      Please <a href="${securityUrl}" style="color: ${BRAND_COLORS.primary}; font-weight: 600;">secure your account immediately</a>
      or contact us at security@balencia.app.
    `)}
  `;

  return baseEmailLayout({
    preheader: `Your Balencia password has been changed - ${timestamp}`,
    title: 'Password Changed - Balencia',
    greeting: `Hi ${firstName},`,
    content,
    footer: {
      text: 'For security questions, contact security@balencia.app',
      showSocial: false,
      showUnsubscribe: false,
    },
  });
}

/**
 * Password reset with OTP code (alternative flow)
 */
export function passwordResetOTPTemplate(data: {
  firstName: string;
  otpCode: string;
  expiresIn?: string;
}): string {
  const { firstName, otpCode, expiresIn = '10 minutes' } = data;

  const content = `
    <p style="margin: 0 0 20px 0;">
      Use the code below to reset your Balencia password. Enter this code in the app to proceed:
    </p>

    ${codeBox(otpCode, 'Your Reset Code')}

    ${alertBox('info', `This code expires in <strong>${expiresIn}</strong>. Don't share this code with anyone.`)}

    <p style="margin: 20px 0 0 0; font-size: 14px; color: ${BRAND_COLORS.gray500};">
      If you didn't request this code, please ignore this email. Your account is safe.
    </p>
  `;

  return baseEmailLayout({
    preheader: `Your Balencia password reset code: ${otpCode} - Expires in ${expiresIn}`,
    title: 'Password Reset Code - Balencia',
    greeting: `Hi ${firstName},`,
    content,
    footer: {
      text: "Need help? Contact us at support@balencia.app",
      showSocial: false,
      showUnsubscribe: false,
    },
  });
}

/**
 * Multiple failed login attempts warning
 */
export function securityAlertTemplate(data: {
  firstName: string;
  attempts: number;
  ipAddress: string;
  location?: string;
  timestamp: string;
  securityUrl: string;
}): string {
  const { firstName, attempts, ipAddress, location, timestamp, securityUrl } = data;

  const content = `
    ${alertBox('error', `
      <strong>Security Alert:</strong> We detected ${attempts} failed login attempts to your Balencia account.
    `)}

    <p style="margin: 20px 0;">
      Someone tried to access your account but entered the wrong password multiple times. If this was you, no action is needed.
    </p>

    <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #991B1B; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Suspicious Activity Details</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="font-size: 13px; color: #7F1D1D; padding: 4px 0;">
            <strong>Failed Attempts:</strong> ${attempts}
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #7F1D1D; padding: 4px 0;">
            <strong>Time:</strong> ${timestamp}
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; color: #7F1D1D; padding: 4px 0;">
            <strong>IP Address:</strong> ${ipAddress}
          </td>
        </tr>
        ${location ? `
        <tr>
          <td style="font-size: 13px; color: #7F1D1D; padding: 4px 0;">
            <strong>Location:</strong> ${location}
          </td>
        </tr>
        ` : ''}
      </table>
    </div>

    <p style="margin: 0; font-size: 15px;">
      <strong>If this wasn't you:</strong> We recommend changing your password immediately and enabling two-factor authentication.
    </p>
  `;

  return baseEmailLayout({
    preheader: `Security Alert: ${attempts} failed login attempts detected on your Balencia account`,
    title: 'Security Alert - Balencia',
    greeting: `Hi ${firstName},`,
    content,
    ctaButton: {
      text: 'Secure My Account',
      url: securityUrl,
      color: '#EF4444',
    },
    footer: {
      text: 'For immediate assistance, contact security@balencia.app',
      showSocial: false,
      showUnsubscribe: false,
    },
  });
}

export default {
  passwordResetTemplate,
  passwordChangedTemplate,
  passwordResetOTPTemplate,
  securityAlertTemplate,
};
