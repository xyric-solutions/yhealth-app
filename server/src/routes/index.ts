import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import assessmentRoutes from './assessment.routes.js';
import integrationRoutes from './integration.routes.js';
import preferencesRoutes from './preferences.routes.js';
import planRoutes from './plan.routes.js';
import uploadRoutes from './upload.routes.js';
import statsRoutes from './stats.routes.js';
import activityRoutes from './activity.routes.js';
import achievementsRoutes from './achievements.routes.js';
import notificationsRoutes from './notifications.routes.js';
import aiCoachRoutes from './ai-coach.routes.js';
import workoutsRoutes from './workouts.routes.js';
import workoutRescheduleRoutes from './workout-reschedule.routes.js';
import waterRoutes from './water.routes.js';
import progressRoutes from './progress.routes.js';
import gamificationRoutes from './gamification.routes.js';
import shoppingListRoutes from './shopping-list.routes.js';
import alarmRoutes from './alarm.routes.js';
import videosRoutes from './videos.routes.js';
import dietPlansRoutes from './diet-plans.routes.js';
import remindersRoutes from './reminders.routes.js';
import taskRoutes from './task.routes.js';
import ragChatbotRoutes from './rag-chatbot.routes.js';
import bodyImagesRoutes from './body-images.routes.js';
import voiceCallsRoutes from './voice-calls.routes.js';
import whatsappWebhookRoutes from './webhooks/whatsapp.routes.js';
import automationRoutes from './automation.routes.js';
import activityStatusRoutes from './activity-status.routes.js';
import accountabilityRoutes from './accountability.routes.js';
import accountabilityContractRoutes from './accountability-contract.routes.js';
import lifeAreasRoutes from './life-areas.routes.js';
import followRoutes from './follow.routes.js';
import ttsRoutes from './tts.routes.js';
import emotionsRoutes from './emotions.routes.js';
import recoveryScoreRoutes from './recovery-score.routes.js';
import reportsRoutes from './reports.routes.js';
import transcriptionRoutes from './transcription.routes.js';
import callSummariesRoutes from './call-summaries.routes.js';
import voiceScheduleRoutes from './voice-schedule.routes.js';
import chatRoutes from './chat.routes.js';
import messageRoutes from './message.routes.js';
import whoopWebhookRoutes from './webhooks/whoop.routes.js';
import whoopAnalyticsRoutes from './whoop-analytics.routes.js';
import wellbeingRoutes from './wellbeing.routes.js';
import journalRoutes from './journal.routes.js';
import stressRoutes from './stress.routes.js';
import scheduleRoutes from './schedule.routes.js';
import nutritionAdaptiveRoutes from './nutrition-adaptive.routes.js';
import blogRoutes from './blog.routes.js';
import adminBlogRoutes from './admin-blog.routes.js';
import adminUserRoutes from './admin-user.routes.js';
import adminRoleRoutes from './admin-role.routes.js';
import contactRoutes from './contact.routes.js';
import adminContactRoutes from './admin-contact.routes.js';
import newsletterRoutes from './newsletter.routes.js';
import adminNewsletterRoutes from './admin-newsletter.routes.js';
import helpRoutes from './help.routes.js';
import adminHelpRoutes from './admin-help.routes.js';
import communityRoutes from './community.routes.js';
import adminCommunityRoutes from './admin-community.routes.js';
import webinarRoutes from './webinar.routes.js';
import adminWebinarRoutes from './admin-webinar.routes.js';
import visitorRoutes from './visitor.routes.js';
import adminAnalyticsRoutes from './admin-analytics.routes.js';
import subscriptionRoutes from './subscription.routes.js';
import adminSubscriptionRoutes from './admin-subscription.routes.js';
import activityEventsRoutes from './activity-events.routes.js';
import leaderboardRoutes from './leaderboard.routes.js';
import scoringRoutes from './scoring.routes.js';
import competitionsRoutes from './competitions.routes.js';
import competitionChatRoutes from './competition-chat.routes.js';
import competitionStreamRoutes from './competition-stream.routes.js';
import exercisesRoutes from './exercises.routes.js';
import adminExerciseRoutes from './admin-exercise.routes.js';
import adminTestimonialRoutes from './admin-testimonial.routes.js';
import testimonialRoutes from './testimonial.routes.js';
import intelligenceRoutes from './intelligence.routes.js';
import spotifyRoutes from './spotify.routes.js';
import youtubeRoutes from './youtube.routes.js';
import emailRoutes from './email.routes.js';
import adminWhoopRoutes from './admin-whoop.routes.js';
import financeRoutes from './finance.routes.js';
import streakRoutes from './streak.routes.js';
import calendarRoutes from './calendar.routes.js';
import obstacleRoutes from './obstacle.routes.js';
import reconnectionRoutes from './reconnection.routes.js';
import { env } from '../config/env.config.js';

const router = Router();

// API info endpoint
router.get('/', (_req, res) => {
  res.json({
    name: 'Balencia API',
    version: env.api.version,
    status: 'running',
    timestamp: new Date().toISOString(),
    documentation: '/api/docs',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      assessment: '/api/assessment',
      integrations: '/api/integrations',
      preferences: '/api/preferences',
      plans: '/api/plans',
      upload: '/api/upload',
      stats: '/api/stats',
      activity: '/api/activity',
      achievements: '/api/achievements',
      notifications: '/api/notifications',
      aiCoach: '/api/ai-coach',
      workouts: '/api/workouts',
      water: '/api/water',
      progress: '/api/progress',
      gamification: '/api/gamification',
      shoppingList: '/api/shopping-list',
      alarms: '/api/alarms',
      videos: '/api/videos',
      dietPlans: '/api/diet-plans',
      reminders: '/api/reminders',
      tasks: '/api/tasks',
      ragChat: '/api/rag-chat',
      bodyImages: '/api/onboarding/body-images',
      voiceCalls: '/api/voice-calls',
      activityStatus: '/api/activity-status',
      tts: '/api/tts',
      chats: '/api/chats',
      messages: '/api/messages',
      intelligence: '/api/v1/intelligence',
      wellbeing: '/api/v1/wellbeing',
      schedules: '/api/v1/schedules',
      nutritionAdaptive: '/api/nutrition',
      automation: '/api/automation',
      activityEvents: '/api/v1/activity-events',
      leaderboards: '/api/v1/leaderboards',
      scoring: '/api/v1/daily-score',
      competitions: '/api/v1/competitions',
      help: '/api/help',
      community: '/api/community',
      webinars: '/api/webinars',
      spotify: '/api/spotify',
      youtube: '/api/youtube',
      email: '/api/email',
      streaks: '/api/streaks',
    },
  });
});

// Health check routes
router.use('/health', healthRoutes);

// Authentication & Onboarding routes (Epic 01 - F1.1)
router.use('/auth', authRoutes);

// Assessment & Goals routes (Epic 01 - F1.2, F1.3)
router.use('/assessment', assessmentRoutes);

// Integration routes (Epic 01 - F1.4)
router.use('/integrations', integrationRoutes);

// Preferences routes (Epic 01 - F1.5)
router.use('/preferences', preferencesRoutes);

// Plan routes (Epic 01 - F1.6)
router.use('/plans', planRoutes);

// File upload routes
router.use('/upload', uploadRoutes);

// Stats routes (Dashboard stats, streaks, health metrics)
router.use('/stats', statsRoutes);

// Activity routes (Activity logs, stats, calendar)
router.use('/activity', activityRoutes);

// Achievements routes
router.use('/achievements', achievementsRoutes);

// Notifications routes
router.use('/notifications', notificationsRoutes);

// AI Coach routes (Deep Assessment)
router.use('/ai-coach', aiCoachRoutes);

// Workout routes (Exercise library, plans, logging)
router.use('/workouts', workoutsRoutes);

// Workout reschedule routes (Auto-rescheduling of missed workouts)
router.use('/workouts/reschedule', workoutRescheduleRoutes);

// Water intake tracking routes
router.use('/water', waterRoutes);

// Progress tracking routes (weight, measurements, photos)
router.use('/progress', progressRoutes);

// Gamification routes (XP, levels, streaks)
router.use('/gamification', gamificationRoutes);

// Shopping list routes
router.use('/shopping-list', shoppingListRoutes);

// Workout alarm/reminder routes
router.use('/alarms', alarmRoutes);

// Motivational videos routes
router.use('/videos', videosRoutes);

// Diet plans and meal logging routes
router.use('/diet-plans', dietPlansRoutes);

// Scheduled reminders routes (meals, workouts, water, etc.)
router.use('/reminders', remindersRoutes);

// User tasks with scheduling and notifications
router.use('/tasks', taskRoutes);

// RAG Chatbot routes (AI Health Coach with vector search)
router.use('/rag-chat', ragChatbotRoutes);

// Body images routes (onboarding)
router.use('/onboarding/body-images', bodyImagesRoutes);

// Voice calls routes (Epic 02 - F2.1)
router.use('/voice-calls', voiceCallsRoutes);

// Webhooks
router.use('/webhooks/whatsapp', whatsappWebhookRoutes);
router.use('/webhooks/whoop', whoopWebhookRoutes);

// WHOOP Analytics
router.use('/whoop/analytics', whoopAnalyticsRoutes);

// Activity Status routes
router.use('/activity-status', activityStatusRoutes);

// Social Accountability routes
router.use('/accountability', accountabilityRoutes);

// Accountability Contracts routes
router.use('/contracts', accountabilityContractRoutes);

// Life Areas routes (Universal Self-Improvement)
router.use('/life-areas', lifeAreasRoutes);

// Follow / Social / Buddy routes
router.use('/follows', followRoutes);

// TTS routes (Text-to-Speech)
router.use('/tts', ttsRoutes);

// Emotion Data routes
router.use('/emotions', emotionsRoutes);

// Mental Recovery Score routes
router.use('/recovery-score', recoveryScoreRoutes);

// Reports routes
router.use('/reports', reportsRoutes);

// Transcription routes (AssemblyAI)
router.use('/transcription', transcriptionRoutes);

// Call Summaries routes (Post-call summaries and action items)
router.use('/call-summaries', callSummariesRoutes);

// Voice Schedule routes (Voice customization and AI call scheduling)
router.use('/voice-schedule', voiceScheduleRoutes);

// Chat routes (Chat and messaging system)
router.use('/chats', chatRoutes);

// Message routes (Message operations)
router.use('/messages', messageRoutes);

// Intelligence routes (Epic 08 - Cross-Domain Intelligence)
router.use('/v1/intelligence', intelligenceRoutes);

// Wellbeing routes (Epic 07 - Wellbeing Pillar)
router.use('/v1/wellbeing', wellbeingRoutes);

// Journal routes (AI Wellness Journaling System - check-ins, life goals, insights)
router.use('/v1/journal', journalRoutes);

// Stress routes (Epic 07 - F7.5: Stress Pattern Detection)
router.use('/v1/wellbeing/stress', stressRoutes);

// Schedule routes (Daily schedules with drag-drop and linking)
router.use('/v1/schedules', scheduleRoutes);

// Adaptive Nutrition routes (Daily analysis, adaptive calorie adjustments, patterns)
router.use('/nutrition', nutritionAdaptiveRoutes);

// Automation routes (Schedule and activity automation settings, logs, testing)
router.use('/automation', automationRoutes);

// Blog routes (Public blog pages)
router.use('/blogs', blogRoutes);

// Admin blog routes (Admin blog management)
router.use('/admin/blogs', adminBlogRoutes);

// Admin user routes (Admin user management)
router.use('/admin/users', adminUserRoutes);
router.use('/admin/roles', adminRoleRoutes);

// Contact form routes (Public contact submission)
router.use('/contact', contactRoutes);

// Admin contact routes (Admin contact management)
router.use('/admin/contacts', adminContactRoutes);

// Newsletter (public subscribe + count)
router.use('/newsletter', newsletterRoutes);

// Admin newsletter (email signups from footer/lead magnet)
router.use('/admin/newsletter', adminNewsletterRoutes);

// Help Center routes (Public help articles)
router.use('/help', helpRoutes);

// Admin help routes (Admin help article management)
router.use('/admin/help', adminHelpRoutes);

// Community routes (Public community posts and discussions)
router.use('/community', communityRoutes);

// Admin community routes (Admin community management)
router.use('/admin/community', adminCommunityRoutes);

// Webinar routes (Public webinar listing and registration)
router.use('/webinars', webinarRoutes);

// Admin webinar routes (Admin webinar management)
router.use('/admin/webinars', adminWebinarRoutes);

// Visitor tracking (public - record visit)
router.use('/visitors', visitorRoutes);

// Admin analytics (visitor analytics, etc.)
router.use('/admin/analytics', adminAnalyticsRoutes);

// Subscription (plans, checkout, portal, my subscription)
router.use('/subscription', subscriptionRoutes);

// Admin subscriptions (plans CRUD, list subscriptions)
router.use('/admin/subscriptions', adminSubscriptionRoutes);

// Leaderboard & Competition routes
router.use('/v1/activity-events', activityEventsRoutes);
router.use('/v1/leaderboards', leaderboardRoutes);
router.use('/leaderboards', leaderboardRoutes); // Alias for backward compatibility
router.use('/v1/daily-score', scoringRoutes);
router.use('/v1/competitions', competitionsRoutes);
router.use('/competitions', competitionsRoutes); // Alias for backward compatibility

// Competition chat routes (live chat within competitions)
router.use('/v1/competitions', competitionChatRoutes);
router.use('/competitions', competitionChatRoutes); // Alias for backward compatibility

// Competition stream routes (live video streams within competitions)
router.use('/v1/competitions', competitionStreamRoutes);
router.use('/competitions', competitionStreamRoutes); // Alias for backward compatibility

// Exercise library (public, no auth required)
router.use('/v1/exercises', exercisesRoutes);

// Admin exercise management
router.use('/admin/exercises', adminExerciseRoutes);

// Testimonial routes (Public testimonials for landing page)
router.use('/testimonials', testimonialRoutes);

// Admin testimonial routes (Admin testimonial/review management)
router.use('/admin/testimonials', adminTestimonialRoutes);

// Spotify routes (Music integration — playlists, playback, recommendations)
router.use('/spotify', spotifyRoutes);

// YouTube routes (Video search for yoga poses)
router.use('/youtube', youtubeRoutes);

// Email engine routes (Preferences, unsubscribe, analytics)
router.use('/email', emailRoutes);

// Admin WHOOP routes (Manual sync, backfill, monitoring)
router.use('/admin/whoop', adminWhoopRoutes);

// Finance & Money Management module
router.use('/finance', financeRoutes);

// Streak tracking routes (status, history, calendar, leaderboard, rewards, freezes)
router.use('/streaks', streakRoutes);

// Google Calendar integration (OAuth, sync, events)
router.use('/calendar', calendarRoutes);

// Obstacle Diagnosis — proactive coach-led diagnosis of repeatedly-missed goals
router.use('/obstacles', obstacleRoutes);

// Goal Reconnection — proactive re-surface of goals gone silent for 21/42/70 days
router.use('/reconnections', reconnectionRoutes);

export default router;
