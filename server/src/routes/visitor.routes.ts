/**
 * Visitor Routes (public)
 * Record visit - no auth; rate-limited by IP
 */

import { Router } from 'express';
import { createRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { recordVisitHandler } from '../controllers/visitor.controller.js';

const router = Router();

const visitorRecordLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 record attempts per minute per IP
  message: 'Too many visit records, please try again later',
});

router.post('/', visitorRecordLimiter, recordVisitHandler);

export default router;
