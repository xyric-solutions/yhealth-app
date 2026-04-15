import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://balencia.app";
const SITE_NAME = "Balencia";

/**
 * Creates consistent metadata for any page.
 */
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export function createMetadata({
  title,
  description,
  keywords,
  path = "",
  noIndex = false,
  ogImage,
  ogType = "website",
}: {
  title: string;
  description: string;
  keywords?: string[];
  path?: string;
  noIndex?: boolean;
  ogImage?: string;
  ogType?: "website" | "article";
}): Metadata {
  const url = `${SITE_URL}${path}`;
  const image = ogImage || DEFAULT_OG_IMAGE;
  return {
    title,
    description,
    keywords: keywords?.join(", "),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: ogType,
      locale: "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

// ============================================
// PAGE METADATA DEFINITIONS
// ============================================

export const SEO = {
  home: createMetadata({
    title: "Balencia - AI Life Coach for Health, Growth & Personal Transformation",
    description:
      "Your AI-powered life coach for total self-improvement. Personalized fitness plans, nutrition guidance, mental wellness tools, life goal tracking, and daily coaching — all in one platform.",
    keywords: [
      "AI life coach",
      "personal improvement platform",
      "AI wellness coach",
      "life goal tracking",
      "personalized coaching app",
      "self-improvement platform",
      "proactive AI coaching",
      "all-in-one life coach",
      "motivation tiers",
      "life goals",
      "AI-powered personal growth",
      "holistic life coaching",
      "daily life coaching",
    ],
    path: "/",
  }),

  about: createMetadata({
    title: "About Balencia - Your AI Life Coach for Personal Transformation",
    description:
      "Balencia combines artificial intelligence with behavioral science to deliver personalized life coaching across fitness, nutrition, mental wellness, and personal growth. Our mission: make world-class life coaching accessible to everyone.",
    keywords: [
      "about Balencia",
      "AI life coaching technology",
      "personal transformation platform",
      "AI-powered life improvement",
      "life coaching startup",
      "personal growth technology",
      "proactive life coaching platform",
    ],
    path: "/about",
  }),

  plans: createMetadata({
    title: "Plans & Pricing - Balencia",
    description:
      "Choose the right plan for your personal growth journey. Starter, Pro, and Premium plans with AI life coaching, analytics, and personalized support. Start free, upgrade anytime.",
    keywords: [
      "Balencia pricing",
      "life coaching plans",
      "subscription plans",
      "AI life coach pricing",
      "personal growth subscription",
    ],
    path: "/plans",
  }),

  subscription: createMetadata({
    title: "Subscription - Balencia",
    description:
      "Manage your Balencia subscription, view your current plan, and upgrade or change plans. Billing and usage in one place.",
    keywords: [
      "Balencia subscription",
      "manage subscription",
      "billing",
      "upgrade plan",
    ],
    path: "/subscription",
  }),

  // --- Blogs ---
  blogList: createMetadata({
    title: "Life Improvement Blog - Expert Tips & AI-Driven Insights",
    description:
      "Read expert articles on fitness, nutrition, mental wellness, personal growth, and life improvement. Evidence-based tips, AI coaching insights, and actionable guides to become your best self.",
    keywords: [
      "life improvement blog",
      "personal growth articles",
      "fitness tips",
      "nutrition advice",
      "mental wellness articles",
      "AI coaching insights",
      "self-improvement guide",
      "life coaching blog",
      "exercise science articles",
      "mindfulness tips",
    ],
    path: "/blogs",
  }),

  // --- Auth ---
  signIn: createMetadata({
    title: "Sign In to Balencia - Access Your Life Coaching Dashboard",
    description:
      "Sign in to your Balencia account to access personalized plans, life goal tracking, wellness insights, and your AI life coach.",
    keywords: [
      "Balencia login",
      "health app sign in",
      "wellness dashboard login",
    ],
    path: "/auth/signin",
    noIndex: true,
  }),

  signUp: createMetadata({
    title: "Create Your Balencia Account - Start Your Life Improvement Journey",
    description:
      "Join Balencia for free and get an AI life coach with personalized fitness plans, nutrition guidance, mood monitoring, and life goal tracking — tailored to your aspirations.",
    keywords: [
      "Balencia sign up",
      "create life coaching account",
      "free life coach app",
      "start personal growth journey",
      "AI life coach signup",
    ],
    path: "/auth/signup",
  }),

  forgotPassword: createMetadata({
    title: "Reset Your Password - Balencia",
    description: "Forgot your Balencia password? Reset it securely and regain access to your personalized health dashboard.",
    path: "/auth/forgot-password",
    noIndex: true,
  }),

  resetPassword: createMetadata({
    title: "Set New Password - Balencia",
    description: "Create a new secure password for your Balencia account.",
    path: "/auth/reset-password",
    noIndex: true,
  }),

  verify: createMetadata({
    title: "Verify Your Email - Balencia",
    description: "Verify your email address to activate your Balencia account and start tracking your health journey.",
    path: "/auth/verify",
    noIndex: true,
  }),

  // --- Dashboard & User ---
  dashboard: createMetadata({
    title: "Your Dashboard - Daily Life Coaching Overview",
    description:
      "View your daily snapshot — workouts, nutrition, mood trends, life goal progress, habit streaks, and AI-generated coaching insights all in one personalized dashboard.",
    keywords: [
      "life coaching dashboard",
      "personal growth overview",
      "daily progress tracker",
      "AI coaching dashboard",
      "life improvement summary",
    ],
    path: "/dashboard",
    noIndex: true,
  }),

  profile: createMetadata({
    title: "My Profile - Balencia",
    description: "View and manage your profile, fitness stats, life goals, body metrics, and personal achievements.",
    path: "/profile",
    noIndex: true,
  }),

  profileEdit: createMetadata({
    title: "Edit Profile - Balencia",
    description: "Update your personal information, health preferences, and profile settings.",
    path: "/profile/edit",
    noIndex: true,
  }),

  settings: createMetadata({
    title: "Account Settings - Balencia",
    description: "Manage your Balencia account settings, notification preferences, connected devices, and privacy controls.",
    path: "/settings",
    noIndex: true,
  }),

  notifications: createMetadata({
    title: "Notifications - Balencia",
    description: "Stay on top of your health goals with smart reminders, workout alerts, and wellness notifications.",
    path: "/notifications",
    noIndex: true,
  }),

  messages: createMetadata({
    title: "Messages - Balencia",
    description: "Connect with your health community, coaches, and support team through secure messaging.",
    path: "/messages",
    noIndex: true,
  }),

  chat: createMetadata({
    title: "AI Life Coach Chat - Talk to Your Personal Coach",
    description: "Chat with your AI life coach for personalized guidance on fitness, nutrition, mental wellness, life goals, and personal growth.",
    keywords: [
      "AI life coach chat",
      "personal coaching chatbot",
      "life advice AI",
      "AI personal coach chat",
    ],
    path: "/chat",
    noIndex: true,
  }),

  chatHistory: createMetadata({
    title: "Chat History - Balencia",
    description: "Review past conversations with your AI life coach and revisit personalized recommendations.",
    path: "/chat-history",
    noIndex: true,
  }),

  // --- Health Tracking ---
  goals: createMetadata({
    title: "Life Goals - Set & Track Personalized Targets",
    description:
      "Set personalized goals for fitness, nutrition, sleep, wellness, and life improvement. Track daily progress with AI-powered coaching insights and adaptive milestones.",
    keywords: [
      "life goal setting",
      "personal growth tracker",
      "wellness targets",
      "personalized life goals",
      "smart goal tracking",
    ],
    path: "/goals",
    noIndex: true,
  }),

  activity: createMetadata({
    title: "Activity Tracker - Daily Movement & Exercise Log",
    description:
      "Track your daily activity, steps, calories burned, and active minutes. View detailed exercise history and movement trends.",
    keywords: [
      "activity tracker",
      "daily exercise log",
      "movement tracking",
      "calories burned tracker",
      "fitness activity monitor",
    ],
    path: "/activity",
    noIndex: true,
  }),

  activityStatus: createMetadata({
    title: "Activity Status - Real-Time Health Monitoring",
    description: "Monitor your real-time activity status, heart rate zones, and daily movement patterns.",
    path: "/activity-status",
    noIndex: true,
  }),

  workouts: createMetadata({
    title: "Workout Planner - AI-Generated Exercise Programs",
    description:
      "Access AI-generated workout plans tailored to your fitness level, goals, and schedule. Log exercises, track sets and reps, and monitor progress.",
    keywords: [
      "AI workout planner",
      "personalized exercise plan",
      "fitness program generator",
      "workout tracker",
      "strength training log",
      "exercise routine builder",
    ],
    path: "/workouts",
    noIndex: true,
  }),

  nutrition: createMetadata({
    title: "Nutrition Tracker - Smart Meal Logging & Diet Plans",
    description:
      "Log meals, track macros, and get AI-powered diet recommendations. Monitor calorie intake, nutritional balance, and eating patterns for optimal health.",
    keywords: [
      "nutrition tracker",
      "meal logging app",
      "calorie counter",
      "macro tracker",
      "AI diet planner",
      "food tracking app",
      "personalized meal plans",
    ],
    path: "/nutrition",
    noIndex: true,
  }),

  progress: createMetadata({
    title: "Progress Reports - Visualize Your Personal Transformation",
    description:
      "Visualize your life improvement journey with detailed progress reports. Track body metrics, fitness milestones, life goal completion, and overall personal growth.",
    keywords: [
      "personal growth tracker",
      "life progress report",
      "transformation tracker",
      "self-improvement charts",
      "goal tracking graphs",
    ],
    path: "/progress",
    noIndex: true,
  }),

  achievements: createMetadata({
    title: "Achievements & Rewards - Celebrate Your Life Milestones",
    description:
      "Earn badges, unlock achievements, and celebrate milestones on your personal growth journey. Gamified life coaching to keep you motivated.",
    keywords: [
      "life achievements",
      "personal growth badges",
      "life coaching milestones",
      "gamified self-improvement",
      "personal rewards system",
    ],
    path: "/achievements",
    noIndex: true,
  }),

  // --- Wellbeing ---
  wellbeing: createMetadata({
    title: "Mental Wellbeing Hub - Mood, Stress & Mindfulness Tools",
    description:
      "Comprehensive mental wellness tools — mood tracking, stress management, guided breathing, journaling, habit building, and emotional check-ins powered by AI.",
    keywords: [
      "mental wellbeing app",
      "mood tracker",
      "stress management tools",
      "mindfulness app",
      "emotional wellness platform",
      "mental health tracking",
      "daily wellbeing check-in",
    ],
    path: "/wellbeing",
    noIndex: true,
  }),

  wellbeingMood: createMetadata({
    title: "Mood Tracker - Log & Analyze Your Emotional Patterns",
    description:
      "Track your daily mood, identify emotional triggers, and discover patterns. AI-powered mood analysis with actionable insights for emotional balance.",
    keywords: [
      "mood tracker app",
      "emotional pattern analysis",
      "daily mood journal",
      "mood monitoring",
      "emotional health tracker",
    ],
    path: "/wellbeing/mood",
    noIndex: true,
  }),

  wellbeingEnergy: createMetadata({
    title: "Energy Level Tracker - Optimize Your Daily Vitality",
    description: "Log and track your energy levels throughout the day. Discover what boosts or drains your vitality with AI-powered patterns.",
    keywords: [
      "energy level tracker",
      "daily vitality monitor",
      "fatigue tracking",
      "energy optimization",
    ],
    path: "/wellbeing/energy",
    noIndex: true,
  }),

  wellbeingJournal: createMetadata({
    title: "Wellness Journal - Daily Reflections & Gratitude Log",
    description:
      "Write daily journal entries, practice gratitude, and process emotions with guided prompts. AI-powered sentiment analysis for deeper self-awareness.",
    keywords: [
      "wellness journal",
      "daily gratitude log",
      "guided journaling",
      "emotional processing",
      "self-reflection app",
    ],
    path: "/wellbeing/journal",
    noIndex: true,
  }),

  wellbeingHabits: createMetadata({
    title: "Habit Tracker - Build Healthy Routines That Stick",
    description:
      "Build and track healthy habits with streak tracking, reminders, and progress visualization. Science-backed habit formation with AI coaching.",
    keywords: [
      "habit tracker app",
      "healthy habit builder",
      "streak tracker",
      "daily routine builder",
      "habit formation tool",
    ],
    path: "/wellbeing/habits",
    noIndex: true,
  }),

  wellbeingStress: createMetadata({
    title: "Stress Management - Track & Reduce Your Stress Levels",
    description:
      "Monitor stress levels, identify triggers, and access guided relaxation techniques. Evidence-based stress reduction strategies personalized for you.",
    keywords: [
      "stress tracker",
      "stress management app",
      "anxiety monitor",
      "stress reduction techniques",
      "relaxation tools",
    ],
    path: "/wellbeing/stress",
    noIndex: true,
  }),

  wellbeingBreathing: createMetadata({
    title: "Guided Breathing Exercises - Calm Your Mind Instantly",
    description:
      "Practice guided breathing exercises for stress relief, focus, and relaxation. Multiple techniques including box breathing, 4-7-8, and diaphragmatic breathing.",
    keywords: [
      "guided breathing exercises",
      "breathing techniques app",
      "box breathing",
      "stress relief breathing",
      "meditation breathing",
    ],
    path: "/wellbeing/breathing",
    noIndex: true,
  }),

  wellbeingVision: createMetadata({
    title: "Vision Health - Color Vision Test & Eye Exercises",
    description:
      "Test your color vision with Ishihara-style plates, train your eye muscles with guided exercises, and track your vision health progress over time.",
    keywords: [
      "color vision test",
      "color blindness test",
      "eye exercises",
      "vision health",
      "Ishihara test",
      "eye yoga",
    ],
    path: "/wellbeing/vision",
    noIndex: true,
  }),

  wellbeingEmotionalCheckin: createMetadata({
    title: "Emotional Check-In - AI-Powered Wellness Assessment",
    description:
      "Complete quick emotional check-ins to track your mental state. Get AI-powered insights and personalized wellbeing recommendations.",
    keywords: [
      "emotional check-in",
      "mental health assessment",
      "wellness check",
      "emotional wellness tool",
    ],
    path: "/wellbeing/emotional-checkin",
    noIndex: true,
  }),

  wellbeingSchedule: createMetadata({
    title: "Wellness Schedule - Plan Your Daily Health Routine",
    description:
      "Plan and organize your daily wellness routine. Schedule workouts, meals, meditation, and self-care activities in one intelligent calendar.",
    keywords: [
      "wellness schedule planner",
      "daily health routine",
      "wellness calendar",
      "self-care scheduler",
    ],
    path: "/wellbeing/schedule",
    noIndex: true,
  }),

  wellbeingInsights: createMetadata({
    title: "Wellbeing Insights - Health Correlations & Recurring Themes",
    description:
      "Discover patterns in your wellbeing data. See how sleep, exercise, and mood are connected, and track recurring themes from your journal entries.",
    keywords: [
      "health insights",
      "wellbeing correlations",
      "mood patterns",
      "journal themes",
    ],
    path: "/wellbeing/insights",
    noIndex: true,
  }),

  // --- AI & Voice ---
  aiCoach: createMetadata({
    title: "AI Life Coach - Personalized Guidance for Total Self-Improvement",
    description:
      "Get instant, personalized guidance from your AI life coach. Science-backed recommendations for fitness, nutrition, sleep, mental wellness, and personal growth goals.",
    keywords: [
      "AI life coach",
      "virtual life coach",
      "personalized life guidance",
      "AI personal growth coach",
      "24/7 life coaching assistant",
    ],
    path: "/ai-coach",
    noIndex: true,
  }),

  voiceAssistant: createMetadata({
    title: "Voice Coach Assistant - Hands-Free Life Coaching Support",
    description: "Interact with your AI life coach through voice. Log meals, start workouts, check progress, set intentions, and get coaching tips — completely hands-free.",
    keywords: [
      "voice life coach assistant",
      "hands-free coaching",
      "voice-controlled coaching app",
      "AI voice life coach",
    ],
    path: "/voice-assistant",
    noIndex: true,
  }),

  voiceCall: createMetadata({
    title: "Voice Call - Talk to Your AI Life Coach",
    description: "Have a real-time voice conversation with your AI life coach for in-depth coaching sessions, wellness consultations, and personalized life guidance.",
    path: "/voice-call",
    noIndex: true,
  }),

  // --- Admin ---
  admin: createMetadata({
    title: "Admin Dashboard - Balencia",
    description: "Balencia administration panel for managing users, content, and platform settings.",
    path: "/admin",
    noIndex: true,
  }),

  adminBlogs: createMetadata({
    title: "Blog Management - Balencia Admin",
    description: "Create, edit, and manage blog posts. Track engagement, publish content, and use AI to generate health articles.",
    path: "/admin/blogs",
    noIndex: true,
  }),

  adminBlogCreate: createMetadata({
    title: "Create Blog Post - Balencia Admin",
    description: "Write and publish a new health and wellness blog post with AI-assisted content generation.",
    path: "/admin/blogs/create",
    noIndex: true,
  }),

  // --- Onboarding ---
  onboarding: createMetadata({
    title: "Welcome to Balencia - Personalize Your Life Coaching Journey",
    description: "Set up your profile, define your life goals, and let our AI life coach create a personalized improvement plan tailored to your lifestyle and aspirations.",
    path: "/onboarding",
    noIndex: true,
  }),

  // --- Legal ---
  privacy: createMetadata({
    title: "Privacy Policy - How Balencia Protects Your Health Data",
    description:
      "Learn how Balencia collects, uses, and protects your personal health information. Our commitment to data privacy, GDPR compliance, and transparent data practices.",
    keywords: [
      "Balencia privacy policy",
      "health data privacy",
      "GDPR compliance",
      "data protection",
      "health app privacy",
      "personal data security",
    ],
    path: "/privacy",
  }),

  terms: createMetadata({
    title: "Terms of Service - Balencia Platform Agreement",
    description:
      "Review the terms and conditions governing your use of the Balencia AI health platform. Understand your rights, responsibilities, and our service commitments.",
    keywords: [
      "Balencia terms of service",
      "user agreement",
      "platform terms",
      "health app terms",
      "service agreement",
    ],
    path: "/terms",
  }),

  cookies: createMetadata({
    title: "Cookie Policy - How Balencia Uses Cookies & Tracking",
    description:
      "Understand how Balencia uses cookies, local storage, and similar technologies to enhance your health platform experience and respect your privacy preferences.",
    keywords: [
      "Balencia cookie policy",
      "cookies usage",
      "tracking technologies",
      "cookie preferences",
      "browser cookies health app",
    ],
    path: "/cookies",
  }),

  hipaa: createMetadata({
    title: "HIPAA Compliance - Balencia Health Data Protection Standards",
    description:
      "Learn about Balencia's HIPAA compliance measures, protected health information (PHI) safeguards, and our commitment to healthcare data security standards.",
    keywords: [
      "HIPAA compliance",
      "health data protection",
      "PHI security",
      "healthcare compliance",
      "health information privacy",
      "HIPAA certified health app",
    ],
    path: "/hipaa",
  }),

  security: createMetadata({
    title: "Security - How Balencia Safeguards Your Data",
    description:
      "Explore Balencia's enterprise-grade security infrastructure, encryption standards, SOC 2 compliance, penetration testing, and comprehensive data protection measures.",
    keywords: [
      "Balencia security",
      "data encryption",
      "SOC 2 compliance",
      "health app security",
      "cybersecurity",
      "secure health platform",
    ],
    path: "/security",
  }),

  // --- Resources ---
  faq: createMetadata({
    title: "FAQ - Frequently Asked Questions About Balencia",
    description:
      "Get answers to common questions about Balencia's AI coaching, data security, wearable integrations, pricing, and more. Everything you need to know in one place.",
    keywords: [
      "Balencia FAQ",
      "health app questions",
      "AI coaching FAQ",
      "Balencia security",
      "wearable integrations",
      "Balencia pricing",
    ],
    path: "/faq",
  }),

  helpCenter: createMetadata({
    title: "Help Center - Balencia Support & Guides",
    description:
      "Find answers to your questions about Balencia. Browse our help articles, tutorials, and guides to get the most out of your AI-powered health platform.",
    keywords: [
      "Balencia help",
      "support center",
      "health app help",
      "Balencia FAQ",
      "user guides",
      "Balencia tutorials",
      "health platform support",
    ],
    path: "/help",
  }),

  community: createMetadata({
    title: "Community - Connect with Growth-Minded Individuals",
    description:
      "Join the Balencia community. Share your personal growth journey, ask questions, exchange tips, and connect with thousands of people committed to self-improvement.",
    keywords: [
      "personal growth community",
      "self-improvement forum",
      "life coaching community",
      "personal development discussions",
      "growth support group",
      "life improvement tips",
      "coaching social network",
    ],
    path: "/community",
  }),

  webinars: createMetadata({
    title: "Webinars - Live Health & Wellness Sessions",
    description:
      "Attend live webinars and watch replays on fitness, nutrition, mental health, and wellness. Learn from experts and get your questions answered in real-time.",
    keywords: [
      "health webinars",
      "wellness workshops",
      "fitness webinars",
      "nutrition talks",
      "mental health sessions",
      "online health events",
      "wellness education",
    ],
    path: "/webinars",
  }),

  // --- Company ---
  careers: createMetadata({
    title: "Careers at Balencia - Join Our Mission to Transform Lives",
    description:
      "Explore exciting career opportunities at Balencia. Join our team of innovators building the future of AI-powered life coaching and personal transformation.",
    keywords: [
      "Balencia careers",
      "life coaching tech jobs",
      "AI coaching jobs",
      "personal growth startup careers",
      "coaching technology careers",
      "join Balencia team",
    ],
    path: "/careers",
  }),

  press: createMetadata({
    title: "Press & Media - Balencia News & Coverage",
    description:
      "Stay updated with the latest Balencia news, media coverage, press releases, and company announcements. Download brand assets and press kit.",
    keywords: [
      "Balencia press",
      "Balencia news",
      "health tech news",
      "Balencia media",
      "press releases",
      "Balencia announcements",
    ],
    path: "/press",
  }),
  // --- Contact ---
  contact: createMetadata({
    title: "Contact Us - Get in Touch with Balencia",
    description:
      "Have questions about Balencia? Reach out to our team for support, partnerships, or general inquiries. We're here to help you on your wellness journey.",
    keywords: [
      "contact Balencia",
      "Balencia support",
      "health app contact",
      "wellness platform help",
      "get in touch Balencia",
    ],
    path: "/contact",
  }),

  // --- Fitness & Social ---
  exercises: createMetadata({
    title: "Exercise Library - Browse AI-Curated Workouts | Balencia",
    description:
      "Explore hundreds of AI-curated exercises with step-by-step guides, muscle group targeting, difficulty levels, and video demonstrations. Build your perfect workout routine.",
    keywords: [
      "exercise library",
      "workout database",
      "AI curated exercises",
      "exercise guides",
      "muscle group workouts",
      "fitness exercises",
      "strength training exercises",
      "cardio exercises",
    ],
    path: "/exercises",
  }),

  leaderboard: createMetadata({
    title: "Leaderboard - Compete & Track Your Fitness Rank | Balencia",
    description:
      "See how you stack up against other health enthusiasts. Track your ranking, compete in fitness challenges, and climb the leaderboard with consistent healthy habits.",
    keywords: [
      "fitness leaderboard",
      "health ranking",
      "fitness competition",
      "wellness leaderboard",
      "fitness challenge ranking",
      "health app leaderboard",
    ],
    path: "/leaderboard",
  }),

  competitions: createMetadata({
    title: "Competitions - Join Health & Fitness Challenges | Balencia",
    description:
      "Join exciting health and fitness competitions. Challenge friends, track team progress, earn rewards, and stay motivated with community-driven wellness challenges.",
    keywords: [
      "fitness competitions",
      "health challenges",
      "wellness competitions",
      "fitness challenge app",
      "team fitness challenge",
      "health competition platform",
    ],
    path: "/competitions",
  }),

  yoga: createMetadata({
    title: "Yoga & Meditation - AI-Powered Sessions | Balencia",
    description:
      "Practice yoga and meditation with AI-generated sessions personalized to your health data. Recovery flows, breathwork, guided meditation, and real-time pose library.",
    keywords: [
      "yoga app",
      "guided meditation",
      "recovery yoga",
      "breathwork exercises",
      "AI yoga sessions",
      "yoga pose library",
      "meditation timer",
      "yoga streak tracker",
    ],
    path: "/yoga",
  }),
} as const;
