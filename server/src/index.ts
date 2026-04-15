// Force UTC so the `pg` driver interprets TIMESTAMP columns consistently,
// regardless of the host machine's system timezone.
process.env.TZ = 'UTC';

import { createServer } from "http";
import cluster from "cluster";
import os from "os";

import { app } from "./app.js";
import { env } from "./config/env.config.js";
import { database } from "./config/database.config.js";
import { logger } from "./services/logger.service.js";
import { socketService } from "./services/socket.service.js";
import { reminderProcessorJob } from "./jobs/reminder-processor.job.js";
import { workoutAuditJob } from "./jobs/workout-audit.job.js";
import { nutritionAnalysisJob } from "./jobs/nutrition-analysis.job.js";
import { scheduleAutomationJob } from "./jobs/schedule-automation.job.js";
import { proactiveMessagingJob } from "./jobs/proactive-messaging.job.js";
import { dailyScoringJob } from "./jobs/daily-scoring.job.js";
import { leaderboardMaterializationJob } from "./jobs/leaderboard-materialization.job.js";
import { competitionAutoCreateJob } from "./jobs/competition-auto-create.job.js";
import { coachProfileGenerationJob } from "./jobs/coach-profile-generation.job.js";
import { dailyAnalysisJob } from "./jobs/daily-analysis.job.js";
import { whoopSyncJob } from "./jobs/whoop-sync.job.js";
import { insightsComputationJob } from "./jobs/insights-computation.job.js";
import { lifeHistoryDigestJob } from "./jobs/life-history-digest.job.js";
import { engagementScoringJob } from "./jobs/engagement-scoring.job.js";
import { startEmailDigestJob, stopEmailDigestJob } from "./jobs/email-digest.job.js";
import { streakValidationJob } from "./jobs/streak-validation.job.js";
import { statusFollowUpJob } from "./jobs/status-followup.job.js";
import { statusPatternAnalysisJob } from "./jobs/status-pattern-analysis.job.js";
import { accountabilityTriggerJob } from "./jobs/accountability-trigger.job.js";
import { contractEvaluationJob } from "./jobs/contract-evaluation.job.js";
import { obstacleDetectorJob } from "./jobs/obstacle-detector.job.js";
import { goalReconnectionJob } from "./jobs/goal-reconnection.job.js";
import { startMicroWinsJob, stopMicroWinsJob } from "./jobs/micro-wins.job.js";
import { startBuddySuggestionJob, stopBuddySuggestionJob } from "./jobs/buddy-suggestion.job.js";
import { calendarSyncJob } from "./jobs/calendar-sync.job.js";
import { activityEventProcessor } from "./workers/activity-event-processor.worker.js";
import { ensureDefaultPlans } from "./services/subscription.service.js";
import { query } from "./database/pg.js";

// Embedding & email workers require Redis - lazy import to avoid crash when Redis is unavailable
let embeddingWorker: { close: () => Promise<void> } | null = null;
let emailWorker: { close: () => Promise<void> } | null = null;
let embeddingQueueService: { close: () => Promise<void> } | null = null;

const numCPUs = os.cpus().length;
const ENABLE_CLUSTERING =
  env.isProduction && process.env["CLUSTER_MODE"] === "true";

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error("Shutdown timeout reached. Forcing exit.");
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Stop background jobs
    reminderProcessorJob.stop();
    logger.info("Reminder processor job stopped");

    workoutAuditJob.stop();
    logger.info("Workout audit job stopped");

    nutritionAnalysisJob.stop();
    logger.info("Nutrition analysis job stopped");

    scheduleAutomationJob.stop();
    logger.info("Schedule automation job stopped");

    proactiveMessagingJob.stop();
    logger.info("Proactive messaging job stopped");

    dailyScoringJob.stop();
    logger.info("Daily scoring job stopped");

    leaderboardMaterializationJob.stop();
    logger.info("Leaderboard materialization job stopped");

    competitionAutoCreateJob.stop();
    logger.info("Competition auto-create job stopped");

    coachProfileGenerationJob.stop();
    logger.info("Coach profile generation job stopped");

    dailyAnalysisJob.stop();
    logger.info("Daily analysis job stopped");

    insightsComputationJob.stop();
    logger.info("Insights computation job stopped");

    lifeHistoryDigestJob.stop();
    logger.info("Life history digest job stopped");

    engagementScoringJob.stop();
    logger.info("Engagement scoring job stopped");

    stopEmailDigestJob();
    logger.info("Email digest job stopped");

    streakValidationJob.stop();
    logger.info("Streak validation job stopped");

    statusFollowUpJob.stop();
    logger.info("Status follow-up job stopped");

    statusPatternAnalysisJob.stop();
    logger.info("Status pattern analysis job stopped");

    accountabilityTriggerJob.stop();
    logger.info("Accountability trigger job stopped");

    calendarSyncJob.stop();
    logger.info("Calendar sync job stopped");

    contractEvaluationJob.stop();
    logger.info("Contract evaluation job stopped");

    stopMicroWinsJob();
    logger.info("Micro-wins job stopped");

    stopBuddySuggestionJob();
    logger.info("Buddy suggestion job stopped");

    await activityEventProcessor.stop();
    logger.info("Activity event processor stopped");

    // Close embedding queue and worker (if started)
    if (embeddingQueueService) await embeddingQueueService.close();
    if (embeddingWorker) await embeddingWorker.close();
    logger.info("Embedding worker and queue closed");

    // Close email worker (if started)
    if (emailWorker) await emailWorker.close();
    logger.info("Email worker closed");

    // Stop accepting new connections
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info("HTTP server closed");
    }

    // Disconnect from database
    await database.disconnect();
    logger.info("Database disconnected");

    clearTimeout(shutdownTimeout);
    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    logger.error("Error during shutdown", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  }
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // Connect to database
    await database.connect();

    // NOTE: Full auto-migration is disabled on startup to prevent slow deploys.
    // Run full migrations manually: npm run db:migrate
    // Lightweight column sync runs automatically below (idempotent, ~2-5s).
    try {
      const { runColumnSync } = await import('./database/auto-migrate.js');
      await runColumnSync();
    } catch (err) {
      logger.warn('Column sync failed (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Ensure roles table + default 'User' role exist (required for user registration FK)
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS roles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100) NOT NULL,
          slug VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          is_system BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await query(`
        INSERT INTO roles (id, name, slug, description, is_system) VALUES
          ('11111111-1111-1111-1111-111111111101', 'User', 'user', 'Default application user', true),
          ('11111111-1111-1111-1111-111111111102', 'Admin', 'admin', 'Full administrative access', true),
          ('11111111-1111-1111-1111-111111111106', 'System', 'system', 'System/internal service accounts', true)
        ON CONFLICT (slug) DO NOTHING
      `);
      logger.info('Default roles ensured');
    } catch (err) {
      logger.warn('Failed to ensure default roles (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Ensure streak tables exist (required for streak system)
    try {
      const { readFileSync } = await import('fs');
      const { join } = await import('path');
      const streakMigrationPath = join(import.meta.dirname, 'database', 'migrations', 'add-streak-tables.sql');
      const streakSQL = readFileSync(streakMigrationPath, 'utf-8');
      await query(streakSQL);
      logger.info('Streak tables ensured');
    } catch (err) {
      logger.warn('Failed to ensure streak tables (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Auto-seed subscription plans if table is empty
    try {
      await ensureDefaultPlans();
    } catch (err) {
      logger.warn("Failed to auto-seed subscription plans", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Ensure AI Coach system user exists (required for proactive messaging)
    try {
      const AI_COACH_USER_ID = process.env.AI_COACH_USER_ID || '00000000-0000-0000-0000-000000000001';
      await query(
        `INSERT INTO users (id, email, password, first_name, last_name, role_id, auth_provider, onboarding_status, is_email_verified, is_active)
         VALUES ($1, 'ai-coach@balencia.system', 'SYSTEM_USER_NO_LOGIN', 'AI', 'Coach', '11111111-1111-1111-1111-111111111101', 'local', 'completed', true, true)
         ON CONFLICT (id) DO NOTHING`,
        [AI_COACH_USER_ID]
      );
      logger.info('AI Coach system user ensured');
    } catch (err) {
      logger.warn('Failed to ensure AI Coach user (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Create HTTP server
    const httpServer = createServer(app);

    // Initialize Socket.IO
    socketService.initialize(httpServer);

    // Start embedding worker if Redis is configured (before listen, since this is async)
    if (env.redis.enabled) {
      try {
        const workerModule = await import("./workers/embedding-worker.js");
        const queueModule = await import("./services/embedding-queue.service.js");
        embeddingWorker = workerModule.embeddingWorker;
        embeddingQueueService = queueModule.embeddingQueueService;
        logger.info("Embedding worker and queue started (Redis available)");
      } catch (err) {
        logger.warn("Failed to start embedding worker - Redis may be unavailable", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Start email worker
      try {
        const { startEmailWorker } = await import("./workers/email-worker.js");
        emailWorker = startEmailWorker();
        logger.info("Email worker started (Redis available)");
      } catch (err) {
        logger.warn("Failed to start email worker", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      logger.info("Embedding/email workers skipped (Redis not configured - set REDIS_URL or REDIS_HOST)");
    }

    // Start listening
    httpServer.listen(env.port, env.host, () => {
      logger.info(`Server started`, {
        port: env.port,
        host: env.host,
        environment: env.nodeEnv,
        pid: process.pid,
        nodeVersion: process.version,
      });

      if (env.isDevelopment) {
        logger.info(
          `API available at http://localhost:${env.port}${env.api.prefix}`
        );
        logger.info(
          `Health check at http://localhost:${env.port}${env.api.prefix}/health`
        );
      }

      // Start background jobs. Cron-style jobs run only on one worker in cluster mode to avoid N× repetition.
      // Set ENABLE_BACKGROUND_JOBS=false in .env to disable all background jobs (useful for development)
      const backgroundJobsEnabled = process.env.ENABLE_BACKGROUND_JOBS !== 'false';
      const isSchedulerWorker = !cluster.worker || cluster.worker.id === 0;

      if (isSchedulerWorker && backgroundJobsEnabled) {
        // Lightweight jobs — start immediately
        reminderProcessorJob.start();
        logger.info("Reminder processor job started");

        workoutAuditJob.start();
        logger.info("Workout audit job started");

        nutritionAnalysisJob.start();
        logger.info("Nutrition analysis job started");

        scheduleAutomationJob.start();
        logger.info("Schedule automation job started");

        leaderboardMaterializationJob.start();
        logger.info("Leaderboard materialization job started");

        competitionAutoCreateJob.start();
        logger.info("Competition auto-create job started");

        // Heavy jobs — stagger startup to avoid query storm
        setTimeout(() => {
          proactiveMessagingJob.start();
          logger.info("Proactive messaging job started (staggered 30s)");
        }, 30_000);

        setTimeout(() => {
          dailyScoringJob.start();
          logger.info("Daily scoring job started (staggered 60s)");
        }, 60_000);

        setTimeout(() => {
          dailyAnalysisJob.start();
          logger.info("Daily analysis job started (staggered 120s)");
        }, 120_000);

        setTimeout(() => {
          coachProfileGenerationJob.start();
          logger.info("Coach profile generation job started (staggered 300s)");
        }, 300_000); // 5 minutes — gives proactive messaging (30s) and daily analysis (90s) time to finish and populate cache

        setTimeout(() => {
          whoopSyncJob.start();
          logger.info("WHOOP daily sync job started (staggered 240s)");
        }, 240_000);

        setTimeout(() => {
          insightsComputationJob.start();
          logger.info("Insights computation job started (staggered 360s)");
        }, 360_000);

        setTimeout(() => {
          lifeHistoryDigestJob.start();
          logger.info("Life history digest job started (staggered 420s)");
        }, 420_000);

        setTimeout(() => {
          engagementScoringJob.start();
          logger.info("Engagement scoring job started (staggered 480s)");
        }, 480_000);

        setTimeout(() => {
          startEmailDigestJob();
          logger.info("Email digest job started (staggered 540s)");
        }, 540_000);

        setTimeout(() => {
          streakValidationJob.start();
          logger.info("Streak validation job started (staggered 600s)");
        }, 600_000);

        setTimeout(() => {
          statusFollowUpJob.start();
          logger.info("Status follow-up job started (staggered 660s)");
        }, 660_000);

        setTimeout(() => {
          statusPatternAnalysisJob.start();
          logger.info("Status pattern analysis job started (staggered 720s)");
        }, 720_000);

        setTimeout(() => {
          accountabilityTriggerJob.start();
          logger.info("Accountability trigger job started (staggered 780s)");
        }, 780_000);

        setTimeout(() => {
          contractEvaluationJob.start();
          logger.info("Contract evaluation job started (staggered 840s)");
        }, 840_000);

        setTimeout(() => {
          startMicroWinsJob();
          logger.info("Micro-wins job started (staggered 900s)");
        }, 900_000);

        setTimeout(() => {
          startBuddySuggestionJob();
          logger.info("Buddy suggestion job started (staggered 960s)");
        }, 960_000);

        setTimeout(() => {
          calendarSyncJob.start();
          logger.info("Calendar sync job started (staggered 1020s)");
        }, 1020_000);

        setTimeout(() => {
          obstacleDetectorJob.start();
          logger.info("Obstacle detector job started (staggered 1080s)");
        }, 1080_000);

        setTimeout(() => {
          goalReconnectionJob.start();
          logger.info("Goal reconnection job started (staggered 1140s)");
        }, 1140_000);
      }

      if (!backgroundJobsEnabled) {
        logger.info("Background jobs DISABLED (ENABLE_BACKGROUND_JOBS=false)");
      }

      // Event-driven / queue consumer — start on all workers (or keep on scheduler only if it's a single consumer)
      activityEventProcessor.start();
      logger.info("Activity event processor started");
    });

    // Store server reference for graceful shutdown
    global.server = httpServer;

    // Handle server errors
    httpServer.on("error", (error: NodeJS.ErrnoException) => {
      if (error.syscall !== "listen") {
        throw error;
      }

      switch (error.code) {
        case "EACCES":
          logger.error(`Port ${env.port} requires elevated privileges`);
          process.exit(1);
          break;
        case "EADDRINUSE":
          logger.error(`Port ${env.port} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
  } catch (error) {
    logger.error("Failed to start server", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Server reference for graceful shutdown
let server: ReturnType<typeof createServer> | undefined;

// Cluster mode for production
if (ENABLE_CLUSTERING && cluster.isPrimary) {
  logger.info(`Primary ${process.pid} is running`);
  logger.info(`Forking ${numCPUs} workers...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Handle worker exit
  cluster.on("exit", (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died`, { code, signal });

    // Replace dead worker
    if (!signal) {
      logger.info("Starting a new worker...");
      cluster.fork();
    }
  });

  // Handle worker online
  cluster.on("online", (worker) => {
    logger.info(`Worker ${worker.process.pid} is online`);
  });
} else {
  // Single process mode (development) or worker process
  startServer();

  // Graceful shutdown handlers
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

// Extend global type for server reference
declare global {
  var server: ReturnType<typeof createServer> | undefined;
}

export { startServer };
