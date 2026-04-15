import type { TourStepConfig } from "./types";

/** Current tour content version — increment to re-trigger for users who completed an older version */
export const TOUR_VERSION = 1;

/** Main tour steps shown to all users */
export const TOUR_STEPS: TourStepConfig[] = [
  {
    id: "welcome",
    type: "fullscreen",
    title: "Welcome to Balencia, {firstName}!",
    description:
      "Your AI-powered health companion is ready. Let me show you around your personalized dashboard — it only takes about 2 minutes.",
    icon: "Sparkles",
    accentColor: "from-emerald-500 to-cyan-500",
    ctaPrimary: "Start Tour",
    ctaSecondary: "Skip for now",
  },
  {
    id: "health-dashboard",
    type: "spotlight",
    title: "Your Health Dashboard",
    description:
      "Track heart rate, sleep quality, steps, hydration, and nutrition at a glance. All metrics update in real-time from your connected wearables.",
    targetSelector: '[data-tour="health-dashboard"]',
    tooltipPosition: "bottom",
    icon: "Activity",
    accentColor: "from-cyan-500 to-blue-500",
    navigateTo: "/dashboard",
  },
  {
    id: "competitions",
    type: "spotlight",
    title: "Competitions & Leaderboards",
    description:
      "Compete with friends and the community. AI-powered scoring ensures fair matchups based on your fitness level, not just raw numbers.",
    targetSelector: '[data-tour="competitions"]',
    tooltipPosition: "right",
    icon: "Trophy",
    accentColor: "from-amber-500 to-orange-500",
    navigateTo: "/dashboard",
  },
  {
    id: "ai-coach",
    type: "spotlight",
    title: "Your AI Coach",
    description:
      "Chat or call your personal AI fitness coach. It learns your patterns, adjusts your plans, and provides real-time guidance during workouts.",
    targetSelector: '[data-tour="ai-coach"]',
    tooltipPosition: "right",
    icon: "Bot",
    accentColor: "from-emerald-500 to-cyan-500",
    navigateTo: "/dashboard",
  },
  {
    id: "gamification",
    type: "spotlight",
    title: "Level Up & Earn XP",
    description:
      "Every workout, every healthy meal, every goal hit earns you XP. Maintain your streak for bonus multipliers and unlock achievements.",
    targetSelector: '[data-tour="xp-widget"]',
    tooltipPosition: "left",
    icon: "Flame",
    accentColor: "from-amber-500 to-orange-500",
    navigateTo: "/dashboard",
  },
  {
    id: "integrations",
    type: "spotlight",
    title: "Connect Your Wearables",
    description:
      "Sync with Fitbit, Apple Health, Google Fit, WHOOP, and Strava for automatic health data tracking. All your data in one place.",
    targetSelector: '[data-tour="integrations"]',
    tooltipPosition: "right",
    icon: "Link",
    accentColor: "from-purple-500 to-pink-500",
    navigateTo: "/dashboard?tab=settings",
  },
  {
    id: "community",
    type: "spotlight",
    title: "Chat, Voice & Communication",
    description:
      "Stay connected with your AI Coach, voice assistant, and real-time chat. Get coaching, ask questions, and track your conversation history all in one place.",
    targetSelector: '[data-tour="community"]',
    tooltipPosition: "right",
    icon: "Users",
    accentColor: "from-indigo-500 to-purple-500",
    navigateTo: "/dashboard",
  },
  {
    id: "completion",
    type: "fullscreen",
    title: "You're All Set, {firstName}!",
    description:
      "Your health journey starts now. Your AI coach is ready to create personalized plans just for you.",
    icon: "PartyPopper",
    accentColor: "from-emerald-500 via-cyan-500 to-blue-500",
    ctaPrimary: "Go to Dashboard",
  },
];

/** Extra steps shown only to admin users (inserted before completion) */
export const ADMIN_EXTRA_STEPS: TourStepConfig[] = [
  {
    id: "admin-panel",
    type: "spotlight",
    title: "Admin Dashboard",
    description:
      "As an admin, you have access to user management, analytics, and system configuration. Access it anytime from your sidebar.",
    targetSelector: '[data-tour="admin-panel"]',
    tooltipPosition: "right",
    icon: "Shield",
    accentColor: "from-red-500 to-pink-500",
    adminOnly: true,
    navigateTo: "/dashboard",
  },
];
