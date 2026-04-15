import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import session from "express-session";

import { env } from "./config/env.config.js";
import { logger } from "./services/logger.service.js";
import {
  errorHandler,
  notFoundHandler,
  setupUncaughtHandlers,
} from "./middlewares/error.middleware.js";
import { requestIdMiddleware } from "./middlewares/requestId.middleware.js";
import { globalLimiter } from "./middlewares/rateLimiter.middleware.js";
import routes from "./routes/index.js";
import stripeWebhookRoutes from "./routes/webhooks/stripe.routes.js";

// Setup uncaught exception handlers
setupUncaughtHandlers();

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // Trust proxy (for rate limiting, secure cookies behind reverse proxy)
  app.set("trust proxy", 1);

  // Security middleware — hardened headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "ws:", "https:"],
          fontSrc: ["'self'", "https:", "data:"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // CORS configuration — no wildcard with credentials
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
          callback(null, true);
          return;
        }

        // Strict origin check — no wildcard bypass
        if (env.cors.origin.includes(origin)) {
          callback(null, true);
        } else if (!env.isProduction && env.cors.origin.includes("*")) {
          // Only allow wildcard in development
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: env.cors.credentials,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-Requested-With",
      ],
      exposedHeaders: [
        "X-Request-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
      ],
      maxAge: 86400,
    })
  );

  // Compression
  app.use(
    compression({
      filter: (req: Request, res: Response) => {
        if (req.headers["x-no-compression"]) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6,
      threshold: 1024, 
    })
  );

  // Request ID middleware
  app.use(requestIdMiddleware);

  // Stripe webhook (raw body required for signature verification) - must be before express.json
  app.use(
    env.api.prefix + "/webhooks/stripe",
    express.raw({ type: "application/json" }),
    stripeWebhookRoutes
  );

  // Body parsing (with raw body capture for webhook signature verification)
  app.use(
    express.json({
      limit: "10mb",
      strict: true,
      verify: (req: any, _res, buf) => {
        // Store raw body for webhook signature verification (WHOOP, etc.)
        req.rawBody = buf;
      },
    })
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: "10mb",
    })
  );

  // Cookie parser
  app.use(cookieParser(env.session.secret));

  // Session configuration (using memory store for now, consider connect-pg-simple for production)
  app.use(
    session({
      secret: env.session.secret,
      name: env.session.name,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: env.isProduction,
        httpOnly: true,
        maxAge: env.session.maxAge,
        sameSite: env.isProduction ? "strict" : "lax",
      },
    })
  );

  // Request logging
  if (env.isDevelopment) {
    app.use(morgan("dev"));
  } else {
    app.use(morgan("combined", { stream: logger.stream }));
  }

  // Rate limiting
  app.use(globalLimiter);

  // API Routes
  app.use(env.api.prefix, routes);

  // Root endpoint
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "Balencia API Server",
      version: "1.0.0",
      status: "running",
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

// Export configured app
export const app = createApp();
export default app;
