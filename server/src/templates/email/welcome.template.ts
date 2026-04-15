/**
 * Welcome & Onboarding Email Templates
 * Engaging emails for new user journey
 */

import { baseEmailLayout, featureBox, alertBox, BRAND_COLORS } from './base.template.js';

export interface WelcomeEmailData {
  firstName: string;
  dashboardUrl: string;
  assessmentUrl?: string;
}

/**
 * Welcome email for new users
 */
export function welcomeTemplate(data: WelcomeEmailData): string {
  const { firstName, dashboardUrl, assessmentUrl } = data;

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="font-size: 64px; margin-bottom: 16px;"></div>
      <p style="margin: 0; font-size: 18px; color: ${BRAND_COLORS.gray600};">
        Your AI Life Coach journey begins now
      </p>
    </div>

    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 26px;">
      Welcome to <strong>Balencia</strong> - where invisible intelligence meets visible coaching. We're thrilled to have you join thousands of users who are transforming their lives through personalized AI guidance.
    </p>

    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 26px;">
      Balencia isn't just another health app. We're your trusted companion that connects your <strong>Physical Fitness</strong>, <strong>Nutrition</strong>, and <strong>Daily Wellbeing</strong> to reveal insights you couldn't discover alone.
    </p>

    <!-- Three Pillars -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 32px 0;">
      <tr>
        <td style="text-align: center; padding: 20px; background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); border-radius: 12px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="33%" style="text-align: center; padding: 8px;">
                <div style="font-size: 32px; margin-bottom: 8px;"></div>
                <p style="margin: 0; font-weight: 600; color: ${BRAND_COLORS.dark}; font-size: 14px;">Fitness</p>
              </td>
              <td width="33%" style="text-align: center; padding: 8px;">
                <div style="font-size: 32px; margin-bottom: 8px;"></div>
                <p style="margin: 0; font-weight: 600; color: ${BRAND_COLORS.dark}; font-size: 14px;">Nutrition</p>
              </td>
              <td width="33%" style="text-align: center; padding: 8px;">
                <div style="font-size: 32px; margin-bottom: 8px;"></div>
                <p style="margin: 0; font-weight: 600; color: ${BRAND_COLORS.dark}; font-size: 14px;">Wellbeing</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <h2 style="margin: 32px 0 16px 0; font-size: 20px; color: ${BRAND_COLORS.dark};">What makes Balencia special:</h2>

    ${featureBox('', 'Talk to Your Coach Anytime', 'Available 24/7 via Voice, WhatsApp, or App - get coaching when you need it')}
    ${featureBox('', 'Connect Everything', 'Sync WHOOP, Fitbit, Garmin, Oura & more for unified insights')}
    ${featureBox('', 'Discover Hidden Patterns', 'See how sleep affects workouts, nutrition impacts mood, and more')}
    ${featureBox('', 'Your Pace, Your Way', 'Quick 30-second check-ins or deep journaling - no judgment')}
  `;

  const secondaryContent = `
    <p style="margin: 0 0 16px 0; font-weight: 600; color: ${BRAND_COLORS.dark};">
      Ready to get started? Here's your first step:
    </p>
    <p style="margin: 0; font-size: 14px;">
      Take our ${assessmentUrl ? `<a href="${assessmentUrl}" style="color: ${BRAND_COLORS.primary}; font-weight: 600;">quick health assessment</a>` : 'quick health assessment'} (just 2-3 minutes) to help us personalize your experience. Your AI coach will use this to provide relevant, actionable guidance.
    </p>
  `;

  return baseEmailLayout({
    preheader: `Welcome to Balencia, ${firstName}! Your AI Life Coach is ready to help you achieve your goals.`,
    title: 'Welcome to Balencia!',
    greeting: `Welcome aboard, ${firstName}!`,
    content,
    ctaButton: {
      text: 'Start Your Journey',
      url: assessmentUrl || dashboardUrl,
    },
    secondaryContent,
    footer: {
      text: "We're here to help! Reply to this email anytime with questions.",
      showSocial: true,
      showUnsubscribe: true,
    },
  });
}

/**
 * Onboarding step 1: Complete assessment reminder
 */
export function assessmentReminderTemplate(data: {
  firstName: string;
  assessmentUrl: string;
  daysRegistered: number;
}): string {
  const { firstName, assessmentUrl, daysRegistered } = data;

  const content = `
    <p style="margin: 0 0 20px 0;">
      We noticed you haven't completed your health assessment yet. It only takes <strong>2-3 minutes</strong> and helps us personalize your AI coaching experience!
    </p>

    ${alertBox('info', 'Quick tip: You can choose between a fast assessment (10 questions) or a deeper conversation with our AI for more personalized insights.')}

    <p style="margin: 20px 0;">
      <strong>Why complete the assessment?</strong>
    </p>

    ${featureBox('', 'Personalized Insights', 'We\'ll tailor recommendations to YOUR specific goals and lifestyle')}
    ${featureBox('', 'Better Coaching', 'Your AI coach will understand your context and provide relevant guidance')}
    ${featureBox('', 'Track Progress', 'Establish your baseline to see how far you\'ve come')}
  `;

  return baseEmailLayout({
    preheader: `${firstName}, complete your assessment to unlock personalized AI coaching`,
    title: 'Complete Your Assessment - Balencia',
    greeting: `Hey ${firstName}!`,
    content,
    ctaButton: {
      text: 'Complete Assessment Now',
      url: assessmentUrl,
    },
    footer: {
      text: `You've been with us for ${daysRegistered} day${daysRegistered > 1 ? 's' : ''}. Let's make the most of it!`,
      showSocial: false,
      showUnsubscribe: true,
    },
  });
}

/**
 * Integration setup encouragement
 */
export function integrationReminderTemplate(data: {
  firstName: string;
  integrationsUrl: string;
  connectedCount: number;
  availableIntegrations: string[];
}): string {
  const { firstName, integrationsUrl, connectedCount, availableIntegrations } = data;

  const integrationsList = availableIntegrations.slice(0, 4).map(name => `
    <td style="text-align: center; padding: 12px;">
      <div style="width: 48px; height: 48px; background: ${BRAND_COLORS.gray100}; border-radius: 12px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 24px;"></span>
      </div>
      <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.gray600};">${name}</p>
    </td>
  `).join('');

  const content = `
    <p style="margin: 0 0 20px 0;">
      ${connectedCount > 0
        ? `Great job connecting ${connectedCount} device${connectedCount > 1 ? 's' : ''}! Want to unlock even more insights?`
        : 'Connect your fitness devices and apps to unlock the full power of Balencia\'s cross-domain insights.'}
    </p>

    ${alertBox('success', '<strong>Did you know?</strong> Users who connect 2+ devices discover 3x more actionable insights about their health patterns.')}

    <p style="margin: 24px 0 16px 0; font-weight: 600; color: ${BRAND_COLORS.dark};">
      Available integrations:
    </p>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: ${BRAND_COLORS.gray100}; border-radius: 12px; margin-bottom: 24px;">
      <tr>
        ${integrationsList}
      </tr>
    </table>

    <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.gray500};">
      WHOOP, Fitbit, Garmin, Oura, Strava, Apple Health, and more...
    </p>
  `;

  return baseEmailLayout({
    preheader: `${firstName}, connect your devices to unlock powerful health insights`,
    title: 'Connect Your Devices - Balencia',
    greeting: `Hi ${firstName},`,
    content,
    ctaButton: {
      text: 'Connect Devices',
      url: integrationsUrl,
    },
    footer: {
      text: 'Your data is always encrypted and under your control.',
      showSocial: false,
      showUnsubscribe: true,
    },
  });
}

/**
 * First goal set celebration
 */
export function goalSetTemplate(data: {
  firstName: string;
  goalTitle: string;
  goalCategory: string;
  dashboardUrl: string;
}): string {
  const { firstName, goalTitle, goalCategory, dashboardUrl } = data;

  const content = `
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="width: 80px; height: 80px; background: linear-gradient(135deg, ${BRAND_COLORS.secondary} 0%, #34D399 100%); border-radius: 50%; margin: 0 auto 16px; line-height: 80px;">
        <span style="font-size: 40px;"></span>
      </div>
    </div>

    <p style="margin: 0 0 24px 0; text-align: center; font-size: 18px; color: ${BRAND_COLORS.dark};">
      You've set your first goal - that's a huge step!
    </p>

    <div style="background: linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND_COLORS.gray500}; text-transform: uppercase; letter-spacing: 1px;">Your Goal</p>
      <p style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: ${BRAND_COLORS.dark};">${goalTitle}</p>
      <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.primary};">${goalCategory}</p>
    </div>

    <p style="margin: 0 0 20px 0;">
      Your AI coach will now help you:
    </p>

    ${featureBox('', 'Break it down', 'Create actionable milestones you can achieve')}
    ${featureBox('', 'Stay on track', 'Daily check-ins and gentle reminders')}
    ${featureBox('', 'Adjust as needed', 'Adapt your plan based on your progress')}

    <p style="margin: 24px 0 0 0; font-size: 14px; font-style: italic; color: ${BRAND_COLORS.gray500};">
      "The journey of a thousand miles begins with a single step." - Lao Tzu
    </p>
  `;

  return baseEmailLayout({
    preheader: `${firstName}, you've set your first goal! Your AI coach is ready to help.`,
    title: 'Goal Set! - Balencia',
    greeting: `Amazing, ${firstName}!`,
    content,
    ctaButton: {
      text: 'View My Dashboard',
      url: dashboardUrl,
      color: BRAND_COLORS.secondary,
    },
    footer: {
      showSocial: true,
      showUnsubscribe: true,
    },
  });
}

export default {
  welcomeTemplate,
  assessmentReminderTemplate,
  integrationReminderTemplate,
  goalSetTemplate,
};
