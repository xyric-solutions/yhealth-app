import dotenv from 'dotenv';
import path from 'path';
import type { NodeEnv } from '../types/index.js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Environment validation
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

// Optional environment variables (for reference/documentation)
// JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN, CORS_ORIGIN, SESSION_SECRET,
// REDIS_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET,
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, LOG_LEVEL, etc.

function validateEnv(): void {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }
}

// Validate on import in production
if (process.env['NODE_ENV'] === 'production') {
  validateEnv();
}

// Type-safe environment configuration
export const env = {
  // Node environment
  nodeEnv: (process.env['NODE_ENV'] || 'development') as NodeEnv,
  isProduction: process.env['NODE_ENV'] === 'production',
  isDevelopment: process.env['NODE_ENV'] === 'development',
  isTest: process.env['NODE_ENV'] === 'test',

  // Server
  port: parseInt(process.env['PORT'] || '5000', 10),
  host: process.env['HOST'] || '0.0.0.0',
  forceEmailInDev: process.env['FORCE_EMAIL_IN_DEV'] === 'true',

  // Database (PostgreSQL via Prisma)
  database: {
    url: process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/balencia?schema=public',
  },

  // JWT Configuration
  jwt: {
    secret: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-change-in-production',
    refreshSecret: process.env['JWT_REFRESH_SECRET'] || 'your-refresh-secret-key-change-in-production',
    expiresIn: process.env['JWT_EXPIRES_IN'] || '15m',
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '7d',
    issuer: process.env['JWT_ISSUER'] || 'balencia-api',
    audience: process.env['JWT_AUDIENCE'] || 'balencia-client',
  },

  // Session
  session: {
    secret: process.env['SESSION_SECRET'] || 'your-session-secret-change-in-production',
    name: process.env['SESSION_NAME'] || 'balencia.sid',
    maxAge: parseInt(process.env['SESSION_MAX_AGE'] || '86400000', 10), // 24 hours
  },

  // CORS
  cors: {
    origin: process.env['CORS_ORIGIN']?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10), // 15 minutes
    max: parseInt(process.env['RATE_LIMIT_MAX'] || '100', 10),
  },

  // Redis (optional)
  redis: {
    url: process.env['REDIS_URL'],
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
    password: process.env['REDIS_PASSWORD'],
    enabled: !!process.env['REDIS_URL'] || !!process.env['REDIS_HOST'],
  },

  // AWS S3
  aws: {
    accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
    secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
    region: process.env['AWS_REGION'] || 'us-east-1',
    s3Bucket: process.env['AWS_S3_BUCKET'],
  },

  // Cloudflare R2 Storage
  r2: {
    accountId: process.env['R2_ACCOUNT_ID'],
    accessKeyId: process.env['R2_ACCESS_KEY_ID'],
    secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'],
    bucketName: process.env['R2_BUCKET_NAME'] || 'balencia',
    publicUrl: process.env['R2_PUBLIC_URL'],
    endpoint: process.env['R2_ACCOUNT_ID']
      ? `https://${process.env['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com`
      : undefined,
  },

  // Email (SMTP)
  smtp: {
    host: process.env['SMTP_HOST'],
    port: parseInt(process.env['SMTP_PORT'] || '587', 10),
    secure: process.env['SMTP_SECURE'] === 'true',
    user: process.env['SMTP_USER'] || process.env['SMTP_FROM'],
    pass: process.env['SMTP_PASS'],
    from: process.env['SMTP_FROM'] || process.env['SMTP_USER'] || 'noreply@balencia.com',
  },

  // Stripe
  stripe: {
    secretKey: process.env['STRIPE_SECRET_KEY'],
    webhookSecret: process.env['STRIPE_WEBHOOK_SECRET'],
  },

  // PayPal
  paypal: {
    clientId: process.env['PAYPAL_CLIENT_ID'],
    clientSecret: process.env['PAYPAL_CLIENT_SECRET'],
    mode: process.env['NODE_ENV'] === 'production' ? 'live' : 'sandbox',
  },

  // Logging
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
    format: process.env['LOG_FORMAT'] || 'combined',
  },

  // API versioning
  api: {
    version: process.env['API_VERSION'] || 'v1',
    prefix: process.env['API_PREFIX'] || '/api',
  },

  // Client URL (for OAuth callbacks)
  client: {
    url: process.env['CLIENT_URL'] || process.env['CORS_ORIGIN']?.split(',')[0] || 'http://localhost:3000',
  },

  // Google Gemini (primary LLM provider)
  gemini: {
    apiKey: process.env['GEMINI_API_KEY'],
    model: process.env['GEMINI_MODEL'] || 'gemini-2.5-flash',
    reasoningModel: process.env['GEMINI_REASONING_MODEL'] || 'gemini-2.5-pro',
    lightModel: process.env['GEMINI_LIGHT_MODEL'] || 'gemini-2.5-flash',
    visionModel: process.env['GEMINI_VISION_MODEL'] || 'gemini-2.5-flash-lite',
  },

  // Anthropic (fallback LLM provider)
  anthropic: {
    apiKey: process.env['ANTHROPIC_API_KEY'],
    model: process.env['ANTHROPIC_MODEL'] || 'claude-sonnet-4-6',
    maxTokens: parseInt(process.env['ANTHROPIC_MAX_TOKENS'] || '1000', 10),
  },

  // DeepSeek AI (fallback provider)
  deepseek: {
    apiKey: process.env['DEEPSEEK_API_KEY'],
    model: process.env['DEEPSEEK_MODEL'] || 'deepseek-chat',
    reasoningModel: process.env['DEEPSEEK_REASONING_MODEL'] || 'deepseek-reasoner',
    baseUrl: process.env['DEEPSEEK_BASE_URL'] || 'https://api.deepseek.com',
  },

  // OpenAI (fallback provider — kept for embeddings)
  openai: {
    apiKey: process.env['OPENAI_API_KEY'],
    model: process.env['OPENAI_MODEL'] || 'gpt-5-mini',
    maxTokens: parseInt(process.env['OPENAI_MAX_TOKENS'] || '1000', 10),
  },

  // Twilio (Voice Calls & WhatsApp)
  twilio: {
    accountSid: process.env['TWILIO_ACCOUNT_SID'],
    authToken: process.env['TWILIO_AUTH_TOKEN'],
    phoneNumber: process.env['TWILIO_PHONE_NUMBER'],
    whatsappNumber: process.env['TWILIO_WHATSAPP_NUMBER'],
    apiKey: process.env['TWILIO_API_KEY'],
    apiSecret: process.env['TWILIO_API_SECRET'],
  },

  // ElevenLabs (Text-to-Speech)
  elevenlabs: {
    apiKey: process.env['ELEVEN_LAB_API_KEY'],
  },

  // Google Cloud Text-to-Speech (Chirp 3 HD voices - fallback TTS)
  googleCloudTts: {
    apiKey: process.env['GOOGLE_CLOUD_VOICE_API_KEY'],
  },

  // AssemblyAI (Speech-to-Text)
  assemblyai: {
    apiKey: process.env['ASSEMBLY_VOICE_API_KEY'] || '',
  },

  // ExerciseDB / RapidAPI (Exercise Data Ingestion)
  exercisedb: {
    rapidApiKey: process.env['EXERCISEDB_RAPIDAPI_KEY'],
    rapidApiHost: process.env['EXERCISEDB_RAPIDAPI_HOST'] || 'exercisedb.p.rapidapi.com',
    syncIntervalMs: parseInt(process.env['EXERCISE_SYNC_INTERVAL_MS'] || '604800000', 10), // 7 days
  },

  // MuscleWiki RapidAPI (Exercise Videos & Data)
  musclewiki: {
    rapidApiKey: process.env['MUSCLEWIKI_RAPIDAPI_KEY'],
    rapidApiHost: process.env['MUSCLEWIKI_RAPIDAPI_HOST'] || 'musclewiki-api.p.rapidapi.com',
  },

  // WHOOP Integration
  whoop: {
    // Application-level OAuth credentials (same for all users)
    // These should be set as environment variables, not per-user
    clientId: process.env['WHOOP_CLIENT_ID'],
    clientSecret: process.env['WHOOP_CLIENT_SECRET'],
    webhookSecret: process.env['WHOOP_WEBHOOK_SECRET'],
    webhookBaseUrl: process.env['WHOOP_WEBHOOK_BASE_URL'] || process.env['API_BASE_URL'] || 'https://api.balencia.com',
    // Sync job configuration
    syncHour: parseInt(process.env['WHOOP_SYNC_HOUR'] || '8', 10),
    syncConcurrency: parseInt(process.env['WHOOP_SYNC_CONCURRENCY'] || '3', 10),
    syncMaxRetries: parseInt(process.env['WHOOP_SYNC_MAX_RETRIES'] || '3', 10),
    syncBackoffBaseMs: parseInt(process.env['WHOOP_SYNC_BACKOFF_BASE_MS'] || '2000', 10),
  },

  // Spotify Integration (Music for workouts, meditation, recovery)
  spotify: {
    clientId: process.env['SPOTIFY_CLIENT_ID'],
    clientSecret: process.env['SPOTIFY_CLIENT_SECRET'],
    redirectUri: process.env['SPOTIFY_REDIRECT_URI'] || 'http://localhost:3000/settings?callback=spotify',
  },

  // Jamendo Integration (Free CC-licensed music fallback when Spotify not configured)
  jamendo: {
    clientId: process.env['JAMENDO_CLIENT_ID'],
    clientSecret: process.env['JAMENDO_CLIENT_SECRET'],
  },

  // Google APIs (YouTube Data API v3)
  google: {
    apiKey: process.env['GOOGLE_API_KEY'],
  },
} as const;

export type EnvConfig = typeof env;
export default env;
