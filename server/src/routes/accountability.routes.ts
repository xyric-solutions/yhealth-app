import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { z } from 'zod';
import { accountabilityController } from '../controllers/accountability.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// H4: UUID param validation middleware
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validateUuidParams(req: Request, res: Response, next: NextFunction): void {
  for (const [key, value] of Object.entries(req.params)) {
    if (typeof value === 'string' && !uuidRegex.test(value)) {
      res.status(400).json({ success: false, message: `Invalid ${key}: must be a valid UUID` });
      return;
    }
  }
  next();
}

// M5: Write rate limiter (shared across write endpoints)
const writeRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20, keyGenerator: 'user' });

// ============================================================================
// CONSENT
// ============================================================================

router.get('/consent', accountabilityController.getConsent);

router.put(
  '/consent',
  writeRateLimiter,
  validate(z.object({
    enabled: z.boolean().optional(),
    allow_motivation_reminders: z.boolean().optional(),
    allow_failure_alerts: z.boolean().optional(),
    allow_sos_alerts: z.boolean().optional(),
    sos_inactivity_days: z.number().min(1).max(30).optional(),
    sos_message: z.string().max(500).optional(),
    ai_intervene_first: z.boolean().optional(),
    global_cooldown_hours: z.number().min(1).max(168).optional(),
  })),
  accountabilityController.updateConsent
);

router.post('/consent/revoke-all', writeRateLimiter, accountabilityController.revokeAll);

// ============================================================================
// CONTACTS
// ============================================================================

router.get('/contacts', accountabilityController.getContacts);

router.post(
  '/contacts',
  createRateLimiter({ windowMs: 60_000, max: 10, keyGenerator: 'user' }),
  validate(z.object({
    contact_user_id: z.string().uuid(),
    nickname: z.string().max(100).optional(),
    role: z.enum(['friend', 'spouse', 'family', 'coach', 'mentor']).optional(),
  })),
  accountabilityController.addContact
);

router.delete('/contacts/:contactId', validateUuidParams, accountabilityController.removeContact);

router.put(
  '/contacts/:contactId/consent',
  validateUuidParams,
  writeRateLimiter,
  validate(z.object({
    allow_motivation: z.boolean().optional(),
    allow_failure: z.boolean().optional(),
    allow_sos: z.boolean().optional(),
    is_emergency_contact: z.boolean().optional(),
  })),
  accountabilityController.updateContactConsent
);

// ============================================================================
// GROUPS
// ============================================================================

router.get('/groups', accountabilityController.getGroups);

router.post(
  '/groups',
  writeRateLimiter,
  validate(z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    contact_ids: z.array(z.string().uuid()).max(50).optional(),
  })),
  accountabilityController.createGroup
);

router.delete('/groups/:groupId', validateUuidParams, accountabilityController.deleteGroup);

router.post(
  '/groups/:groupId/members',
  validateUuidParams,
  writeRateLimiter,
  validate(z.object({
    contact_id: z.string().uuid(),
  })),
  accountabilityController.addGroupMember
);

router.delete('/groups/:groupId/members/:contactId', validateUuidParams, accountabilityController.removeGroupMember);

// ============================================================================
// TRIGGERS
// ============================================================================

router.get('/triggers', accountabilityController.getTriggers);

router.post(
  '/triggers',
  writeRateLimiter,
  validate(z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    condition_type: z.enum(['inactivity', 'metric_threshold', 'streak_break', 'login_gap', 'custom']),
    condition_metric: z.string().max(100).optional(),
    condition_operator: z.enum(['lt', 'gt', 'eq', 'gte', 'lte', 'missed']).optional(),
    condition_value: z.number().optional(),
    condition_window_days: z.number().min(1).max(30).optional(),
    target_type: z.enum(['contact', 'group', 'emergency']),
    target_contact_id: z.string().uuid().optional(),
    target_group_id: z.string().uuid().optional(),
    message_type: z.enum(['motivation', 'failure', 'sos']).optional(),
    message_template: z.string().max(500).optional(),
    cooldown_hours: z.number().min(1).max(168).optional(),
    ai_intervene_first: z.boolean().optional(),
  })),
  accountabilityController.createTrigger
);

router.put(
  '/triggers/:triggerId',
  validateUuidParams,
  writeRateLimiter,
  validate(z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    condition_value: z.number().optional(),
    condition_window_days: z.number().min(1).max(30).optional(),
    message_template: z.string().max(500).optional(),
    cooldown_hours: z.number().min(1).max(168).optional(),
    ai_intervene_first: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })),
  accountabilityController.updateTrigger
);

router.delete('/triggers/:triggerId', validateUuidParams, accountabilityController.deleteTrigger);

// ============================================================================
// LOGS & AUDIT
// ============================================================================

router.get('/logs', accountabilityController.getTriggerLogs);

router.get('/audit', accountabilityController.getAuditLog);

// ============================================================================
// EMERGENCY
// ============================================================================

router.get('/emergency-contacts', accountabilityController.getEmergencyContacts);

export default router;
