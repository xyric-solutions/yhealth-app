/**
 * Balencia Email Templates - Base Layout
 * Modern, responsive email templates aligned with AI Life Coach branding
 */

export interface EmailTemplateData {
  preheader?: string;
  title: string;
  greeting?: string;
  content: string;
  ctaButton?: {
    text: string;
    url: string;
    color?: string;
  };
  secondaryContent?: string;
  footer?: {
    text?: string;
    showSocial?: boolean;
    showUnsubscribe?: boolean;
  };
}

// Brand Colors
export const BRAND_COLORS = {
  primary: '#6366F1',      // Indigo - Main brand color
  primaryDark: '#4F46E5',  // Darker indigo for hover states
  secondary: '#10B981',    // Emerald - Success/positive actions
  accent: '#F59E0B',       // Amber - Highlights
  dark: '#1F2937',         // Dark gray for text
  light: '#F9FAFB',        // Light background
  white: '#FFFFFF',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #A855F7 100%)',
};

/**
 * Base email layout wrapper
 * Responsive design that works across all email clients
 */
export function baseEmailLayout(data: EmailTemplateData): string {
  const {
    preheader = '',
    title,
    greeting,
    content,
    ctaButton,
    secondaryContent,
    footer = { showSocial: true, showUnsubscribe: true },
  } = data;

  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    html, body { margin: 0 !important; padding: 0 !important; height: 100% !important; width: 100% !important; }
    * { -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; }
    table { border-spacing: 0 !important; border-collapse: collapse !important; table-layout: fixed !important; margin: 0 auto !important; }
    img { -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; }

    /* Progressive Enhancement */
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .fluid { max-width: 100% !important; height: auto !important; margin-left: auto !important; margin-right: auto !important; }
      .stack-column, .stack-column-center { display: block !important; width: 100% !important; max-width: 100% !important; direction: ltr !important; }
      .stack-column-center { text-align: center !important; }
      .center-on-narrow { text-align: center !important; display: block !important; margin-left: auto !important; margin-right: auto !important; float: none !important; }
      table.center-on-narrow { display: inline-block !important; }
      .email-container p { font-size: 16px !important; line-height: 26px !important; }
    }

    /* Dark Mode */
    @media (prefers-color-scheme: dark) {
      .email-bg { background: #1a1a2e !important; }
      .darkmode-bg { background: #16213e !important; }
      .darkmode-text { color: #f5f5f5 !important; }
    }
  </style>
</head>
<body width="100%" style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: ${BRAND_COLORS.light};" class="email-bg">

  <!-- Preheader Text -->
  <div style="display: none; font-size: 1px; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${preheader}
  </div>

  <center role="article" aria-roledescription="email" lang="en" style="width: 100%; background-color: ${BRAND_COLORS.light};" class="email-bg">

    <!-- Email Container -->
    <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: auto;" class="email-container">

      <!-- Header with Logo -->
      <tr>
        <td style="padding: 30px 0; text-align: center;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="text-align: center;">
                <!-- Logo -->
                <div style="font-size: 32px; font-weight: 800; color: ${BRAND_COLORS.primary}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; letter-spacing: -1px;">
                  <span style="background: ${BRAND_COLORS.gradient}; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">y</span><span style="color: ${BRAND_COLORS.dark};">Health</span>
                </div>
                <div style="font-size: 12px; color: ${BRAND_COLORS.gray500}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px;">
                  Your AI Life Coach
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Main Content Card -->
      <tr>
        <td style="padding: 0 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${BRAND_COLORS.white}; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);" class="darkmode-bg">

            <!-- Gradient Top Bar -->
            <tr>
              <td style="height: 6px; background: ${BRAND_COLORS.gradient}; border-radius: 16px 16px 0 0;"></td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 40px 40px 20px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

                ${greeting ? `
                <!-- Greeting -->
                <h1 style="margin: 0 0 24px 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.dark}; line-height: 1.3;" class="darkmode-text">
                  ${greeting}
                </h1>
                ` : ''}

                <!-- Main Content -->
                <div style="font-size: 16px; line-height: 26px; color: ${BRAND_COLORS.gray600};" class="darkmode-text">
                  ${content}
                </div>

                ${ctaButton ? `
                <!-- CTA Button -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 32px 0;">
                  <tr>
                    <td align="center">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="border-radius: 12px; background: ${ctaButton.color || BRAND_COLORS.gradient};">
                            <a href="${ctaButton.url}" target="_blank" style="display: inline-block; padding: 16px 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 16px; font-weight: 600; color: ${BRAND_COLORS.white}; text-decoration: none; border-radius: 12px;">
                              ${ctaButton.text}
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
                ` : ''}

                ${secondaryContent ? `
                <!-- Secondary Content -->
                <div style="font-size: 14px; line-height: 22px; color: ${BRAND_COLORS.gray500}; margin-top: 24px; padding-top: 24px; border-top: 1px solid ${BRAND_COLORS.gray200};" class="darkmode-text">
                  ${secondaryContent}
                </div>
                ` : ''}

              </td>
            </tr>

            <!-- Footer inside card -->
            <tr>
              <td style="padding: 20px 40px 40px 40px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td style="padding-top: 24px; border-top: 1px solid ${BRAND_COLORS.gray200};">
                      <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: ${BRAND_COLORS.gray500};">
                        ${footer.text || 'Need help? Reply to this email or contact us at support@balencia.app'}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

          </table>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding: 30px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">

            ${footer.showSocial ? `
            <!-- Social Links -->
            <tr>
              <td style="text-align: center; padding-bottom: 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                  <tr>
                    <td style="padding: 0 8px;">
                      <a href="https://twitter.com/balenciaapp" style="display: inline-block; width: 36px; height: 36px; background: ${BRAND_COLORS.gray200}; border-radius: 50%; text-align: center; line-height: 36px;">
                        <img src="https://cdn-icons-png.flaticon.com/24/733/733579.png" width="18" height="18" alt="Twitter" style="vertical-align: middle;">
                      </a>
                    </td>
                    <td style="padding: 0 8px;">
                      <a href="https://instagram.com/balenciaapp" style="display: inline-block; width: 36px; height: 36px; background: ${BRAND_COLORS.gray200}; border-radius: 50%; text-align: center; line-height: 36px;">
                        <img src="https://cdn-icons-png.flaticon.com/24/2111/2111463.png" width="18" height="18" alt="Instagram" style="vertical-align: middle;">
                      </a>
                    </td>
                    <td style="padding: 0 8px;">
                      <a href="https://linkedin.com/company/balenciaapp" style="display: inline-block; width: 36px; height: 36px; background: ${BRAND_COLORS.gray200}; border-radius: 50%; text-align: center; line-height: 36px;">
                        <img src="https://cdn-icons-png.flaticon.com/24/3536/3536505.png" width="18" height="18" alt="LinkedIn" style="vertical-align: middle;">
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ` : ''}

            <!-- Company Info -->
            <tr>
              <td style="text-align: center;">
                <p style="margin: 0 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: ${BRAND_COLORS.gray500};">
                  Balencia by Xyric Solutions
                </p>
                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; color: ${BRAND_COLORS.gray400};">
                  Your AI Life Coach - Powered by invisible intelligence
                </p>
              </td>
            </tr>

            ${footer.showUnsubscribe ? `
            <!-- Unsubscribe -->
            <tr>
              <td style="text-align: center; padding-top: 16px;">
                <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: ${BRAND_COLORS.gray400};">
                  <a href="{{unsubscribe_url}}" style="color: ${BRAND_COLORS.gray400}; text-decoration: underline;">Unsubscribe</a> | <a href="{{preferences_url}}" style="color: ${BRAND_COLORS.gray400}; text-decoration: underline;">Email Preferences</a>
                </p>
              </td>
            </tr>
            ` : ''}

          </table>
        </td>
      </tr>

    </table>

  </center>
</body>
</html>
  `.trim();
}

/**
 * Feature highlight box component
 */
export function featureBox(icon: string, title: string, description: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 16px 0;">
      <tr>
        <td width="48" valign="top" style="padding-right: 16px;">
          <div style="width: 48px; height: 48px; background: ${BRAND_COLORS.gray100}; border-radius: 12px; text-align: center; line-height: 48px; font-size: 24px;">
            ${icon}
          </div>
        </td>
        <td valign="top">
          <p style="margin: 0 0 4px 0; font-weight: 600; color: ${BRAND_COLORS.dark}; font-size: 15px;">${title}</p>
          <p style="margin: 0; color: ${BRAND_COLORS.gray500}; font-size: 14px; line-height: 20px;">${description}</p>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Stats/metrics box component
 */
export function statsBox(items: Array<{ value: string; label: string }>): string {
  const columns = items.map(item => `
    <td style="text-align: center; padding: 16px;">
      <p style="margin: 0 0 4px 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.primary};">${item.value}</p>
      <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.gray500}; text-transform: uppercase; letter-spacing: 1px;">${item.label}</p>
    </td>
  `).join('');

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: ${BRAND_COLORS.gray100}; border-radius: 12px; margin: 24px 0;">
      <tr>
        ${columns}
      </tr>
    </table>
  `;
}

/**
 * Alert/notification box component
 */
export function alertBox(type: 'info' | 'warning' | 'success' | 'error', message: string): string {
  const colors = {
    info: { bg: '#EEF2FF', border: BRAND_COLORS.primary, icon: 'i' },
    warning: { bg: '#FFFBEB', border: BRAND_COLORS.accent, icon: '!' },
    success: { bg: '#ECFDF5', border: BRAND_COLORS.secondary, icon: '&#10003;' },
    error: { bg: '#FEF2F2', border: '#EF4444', icon: '&#10005;' },
  };

  const { bg, border, icon } = colors[type];

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="background: ${bg}; border-left: 4px solid ${border}; border-radius: 0 8px 8px 0; padding: 16px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="24" valign="top" style="padding-right: 12px;">
                <div style="width: 24px; height: 24px; background: ${border}; border-radius: 50%; text-align: center; line-height: 24px; color: white; font-weight: bold; font-size: 12px;">
                  ${icon}
                </div>
              </td>
              <td style="font-size: 14px; color: ${BRAND_COLORS.dark}; line-height: 20px;">
                ${message}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Code/token display box
 */
export function codeBox(code: string, label?: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="text-align: center;">
          ${label ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND_COLORS.gray500}; text-transform: uppercase; letter-spacing: 1px;">${label}</p>` : ''}
          <div style="background: ${BRAND_COLORS.gray100}; border: 2px dashed ${BRAND_COLORS.gray200}; border-radius: 12px; padding: 20px;">
            <span style="font-family: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace; font-size: 32px; font-weight: 700; color: ${BRAND_COLORS.primary}; letter-spacing: 8px;">
              ${code}
            </span>
          </div>
        </td>
      </tr>
    </table>
  `;
}

export default {
  baseEmailLayout,
  featureBox,
  statsBox,
  alertBox,
  codeBox,
  BRAND_COLORS,
};
