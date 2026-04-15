/**
 * Onboarding Completion & Progress Email Templates
 * Celebration emails for milestones and achievements
 */

import { baseEmailLayout, featureBox, statsBox, alertBox, BRAND_COLORS } from './base.template.js';

/**
 * Onboarding complete celebration email
 */
export function onboardingCompleteTemplate(data: {
  firstName: string;
  dashboardUrl: string;
  goalsCount: number;
  integrationsCount: number;
  assessmentType: 'quick' | 'deep';
}): string {
  const { firstName, dashboardUrl, goalsCount, integrationsCount, assessmentType } = data;

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <!-- Celebration Animation -->
      <div style="font-size: 72px; margin-bottom: 16px;"></div>
      <h2 style="margin: 0; font-size: 24px; color: ${BRAND_COLORS.dark};">
        You're all set up!
      </h2>
    </div>

    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 26px; text-align: center;">
      Congratulations! You've completed your Balencia onboarding. Your AI Life Coach is now fully personalized and ready to help you achieve your goals.
    </p>

    ${statsBox([
      { value: String(goalsCount), label: 'Goals Set' },
      { value: String(integrationsCount), label: 'Devices Connected' },
      { value: assessmentType === 'deep' ? 'Deep' : 'Quick', label: 'Assessment' },
    ])}

    <h3 style="margin: 32px 0 16px 0; font-size: 18px; color: ${BRAND_COLORS.dark};">What's next?</h3>

    ${featureBox('', 'Check In Daily', 'Start your day with a quick mood check-in or end it with reflection')}
    ${featureBox('', 'Chat Anytime', 'Your AI coach is available 24/7 via app, voice, or WhatsApp')}
    ${featureBox('', 'Review Insights', 'Visit your dashboard to see personalized recommendations')}
    ${featureBox('', 'Stay Consistent', 'Small daily actions lead to big transformations')}

    <div style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, #8B5CF6 100%); border-radius: 12px; padding: 24px; margin: 32px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.8); font-size: 14px;">PRO TIP</p>
      <p style="margin: 0; color: white; font-size: 16px; font-weight: 500;">
        Set a daily reminder to check in with your AI coach. Consistency is the key to lasting change!
      </p>
    </div>
  `;

  return baseEmailLayout({
    preheader: `${firstName}, you're all set! Your personalized AI Life Coach is ready.`,
    title: 'Onboarding Complete! - Balencia',
    greeting: `Awesome work, ${firstName}!`,
    content,
    ctaButton: {
      text: 'Go to My Dashboard',
      url: dashboardUrl,
      color: BRAND_COLORS.secondary,
    },
    footer: {
      text: "Your wellness journey has officially begun. We're rooting for you!",
      showSocial: true,
      showUnsubscribe: true,
    },
  });
}

/**
 * Weekly progress summary email
 */
export function weeklyProgressTemplate(data: {
  firstName: string;
  weekNumber: number;
  dashboardUrl: string;
  stats: {
    checkIns: number;
    goalsProgress: number;
    streakDays: number;
    topInsight?: string;
  };
  achievements?: string[];
}): string {
  const { firstName, weekNumber, dashboardUrl, stats, achievements = [] } = data;

  const achievementsList = achievements.length > 0
    ? achievements.map(a => `
        <tr>
          <td style="padding: 8px 0;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td width="28" style="color: ${BRAND_COLORS.accent}; font-size: 18px;"></td>
                <td style="font-size: 14px; color: ${BRAND_COLORS.dark};">${a}</td>
              </tr>
            </table>
          </td>
        </tr>
      `).join('')
    : '';

  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 26px;">
      Here's your wellness snapshot for Week ${weekNumber}. You're making progress - let's celebrate that!
    </p>

    ${statsBox([
      { value: String(stats.checkIns), label: 'Check-ins' },
      { value: `${stats.goalsProgress}%`, label: 'Goals Progress' },
      { value: String(stats.streakDays), label: 'Day Streak' },
    ])}

    ${stats.topInsight ? `
    <div style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND_COLORS.accent}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
         Top Insight This Week
      </p>
      <p style="margin: 0; font-size: 15px; color: ${BRAND_COLORS.dark}; line-height: 24px;">
        ${stats.topInsight}
      </p>
    </div>
    ` : ''}

    ${achievementsList ? `
    <h3 style="margin: 24px 0 16px 0; font-size: 18px; color: ${BRAND_COLORS.dark};">Achievements Unlocked</h3>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      ${achievementsList}
    </table>
    ` : ''}

    <p style="margin: 24px 0 0 0; font-size: 14px; color: ${BRAND_COLORS.gray500};">
      Keep going, ${firstName}! Every small step counts toward your bigger goals.
    </p>
  `;

  return baseEmailLayout({
    preheader: `${firstName}, here's your Week ${weekNumber} progress - ${stats.streakDays} day streak!`,
    title: `Week ${weekNumber} Summary - Balencia`,
    greeting: `Hi ${firstName},`,
    content,
    ctaButton: {
      text: 'See Full Report',
      url: dashboardUrl,
    },
    footer: {
      showSocial: true,
      showUnsubscribe: true,
    },
  });
}

/**
 * Milestone achieved celebration
 */
export function milestoneAchievedTemplate(data: {
  firstName: string;
  milestoneName: string;
  goalName: string;
  nextMilestone?: string;
  dashboardUrl: string;
}): string {
  const { firstName, milestoneName, goalName, nextMilestone, dashboardUrl } = data;

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 100px; height: 100px; background: linear-gradient(135deg, ${BRAND_COLORS.accent} 0%, #F59E0B 100%); border-radius: 50%; margin: 0 auto 20px; line-height: 100px;">
        <span style="font-size: 48px;"></span>
      </div>
      <h2 style="margin: 0; font-size: 24px; color: ${BRAND_COLORS.dark};">
        Milestone Achieved!
      </h2>
    </div>

    <div style="background: ${BRAND_COLORS.gray100}; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND_COLORS.gray500}; text-transform: uppercase; letter-spacing: 1px;">
        You Completed
      </p>
      <p style="margin: 0 0 12px 0; font-size: 22px; font-weight: 700; color: ${BRAND_COLORS.dark};">
        ${milestoneName}
      </p>
      <p style="margin: 0; font-size: 14px; color: ${BRAND_COLORS.primary};">
        Part of: ${goalName}
      </p>
    </div>

    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 26px;">
      This is a significant achievement! Every milestone you complete brings you closer to your ultimate goal. Your consistency and dedication are paying off.
    </p>

    ${nextMilestone ? `
    <div style="border: 2px dashed ${BRAND_COLORS.gray200}; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND_COLORS.gray500}; text-transform: uppercase; letter-spacing: 1px;">
         Next Up
      </p>
      <p style="margin: 0; font-size: 16px; color: ${BRAND_COLORS.dark}; font-weight: 500;">
        ${nextMilestone}
      </p>
    </div>
    ` : ''}

    <p style="margin: 24px 0 0 0; font-size: 14px; font-style: italic; color: ${BRAND_COLORS.gray500};">
      "Success is the sum of small efforts repeated day in and day out." - Robert Collier
    </p>
  `;

  return baseEmailLayout({
    preheader: `${firstName}, you hit a milestone! ${milestoneName} - Celebrate your progress!`,
    title: 'Milestone Achieved! - Balencia',
    greeting: `Way to go, ${firstName}!`,
    content,
    ctaButton: {
      text: 'View My Progress',
      url: dashboardUrl,
      color: BRAND_COLORS.accent,
    },
    footer: {
      text: 'Share your achievement and inspire others!',
      showSocial: true,
      showUnsubscribe: true,
    },
  });
}

/**
 * Streak milestone celebration
 */
export function streakMilestoneTemplate(data: {
  firstName: string;
  streakDays: number;
  dashboardUrl: string;
}): string {
  const { firstName, streakDays, dashboardUrl } = data;

  // Different messages based on streak length
  const getMessage = () => {
    if (streakDays >= 100) return { emoji: '', message: "Legendary status! You're an inspiration!" };
    if (streakDays >= 30) return { emoji: '', message: "A whole month of consistency! You're unstoppable!" };
    if (streakDays >= 14) return { emoji: '', message: "Two weeks strong! You're building lasting habits!" };
    if (streakDays >= 7) return { emoji: '', message: "One week! The foundation of a great habit!" };
    return { emoji: '', message: "Every day counts! Keep going!" };
  };

  const { emoji, message } = getMessage();

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="font-size: 80px; margin-bottom: 16px;">${emoji}</div>
      <div style="font-size: 64px; font-weight: 800; color: ${BRAND_COLORS.primary}; margin-bottom: 8px;">
        ${streakDays}
      </div>
      <p style="margin: 0; font-size: 18px; color: ${BRAND_COLORS.gray600}; text-transform: uppercase; letter-spacing: 2px;">
        Day Streak
      </p>
    </div>

    <p style="margin: 0 0 24px 0; font-size: 18px; line-height: 28px; text-align: center; color: ${BRAND_COLORS.dark};">
      ${message}
    </p>

    <div style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, #8B5CF6 100%); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
      <p style="margin: 0; color: white; font-size: 16px;">
        You've checked in for <strong>${streakDays} consecutive days</strong>. This consistency is what transforms lives!
      </p>
    </div>

    <p style="margin: 24px 0 0 0; font-size: 14px; color: ${BRAND_COLORS.gray500}; text-align: center;">
      Keep the momentum going. Your future self will thank you!
    </p>
  `;

  return baseEmailLayout({
    preheader: `${firstName}, ${streakDays} day streak! ${emoji} You're on fire!`,
    title: `${streakDays} Day Streak! - Balencia`,
    greeting: `Incredible, ${firstName}!`,
    content,
    ctaButton: {
      text: 'Continue My Streak',
      url: dashboardUrl,
      color: BRAND_COLORS.secondary,
    },
    footer: {
      showSocial: true,
      showUnsubscribe: true,
    },
  });
}

/**
 * Re-engagement email for inactive users
 */
export function reEngagementTemplate(data: {
  firstName: string;
  daysSinceLastActive: number;
  dashboardUrl: string;
  lastGoal?: string;
}): string {
  const { firstName, daysSinceLastActive, dashboardUrl, lastGoal } = data;

  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 26px;">
      We've missed you! It's been ${daysSinceLastActive} days since your last check-in. Your AI coach is still here, ready to support you whenever you're ready to continue.
    </p>

    ${alertBox('info', "Remember: There's no judgment here. Life gets busy, and that's okay. What matters is getting back on track when you're ready.")}

    ${lastGoal ? `
    <div style="background: ${BRAND_COLORS.gray100}; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: ${BRAND_COLORS.gray500}; text-transform: uppercase; letter-spacing: 1px;">
        Your Goal Is Waiting
      </p>
      <p style="margin: 0; font-size: 16px; color: ${BRAND_COLORS.dark}; font-weight: 500;">
        "${lastGoal}"
      </p>
    </div>
    ` : ''}

    <p style="margin: 24px 0 16px 0; font-weight: 600; color: ${BRAND_COLORS.dark};">
      Getting back is easy:
    </p>

    ${featureBox('1', 'Quick Check-in', "Just 30 seconds to log how you're feeling")}
    ${featureBox('2', 'Chat With Your Coach', 'Talk about what\'s been going on')}
    ${featureBox('3', 'Adjust Your Goals', 'We can recalibrate based on your current situation')}

    <p style="margin: 24px 0 0 0; font-size: 14px; font-style: italic; color: ${BRAND_COLORS.gray500};">
      "It's not about being perfect. It's about showing up."
    </p>
  `;

  return baseEmailLayout({
    preheader: `${firstName}, we miss you! Your AI coach is ready when you are.`,
    title: 'We Miss You! - Balencia',
    greeting: `Hey ${firstName},`,
    content,
    ctaButton: {
      text: 'Come Back',
      url: dashboardUrl,
    },
    footer: {
      text: "No pressure - we're here whenever you need us.",
      showSocial: false,
      showUnsubscribe: true,
    },
  });
}

export default {
  onboardingCompleteTemplate,
  weeklyProgressTemplate,
  milestoneAchievedTemplate,
  streakMilestoneTemplate,
  reEngagementTemplate,
};
