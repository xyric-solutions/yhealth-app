import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  createLifeAreaSchema,
  updateLifeAreaSchema,
  linkEntitySchema,
} from '../validators/life-areas.validator.js';
import * as ctrl from '../controllers/life-areas.controller.js';

const router = Router();
router.use(authenticate);

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

const writeRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20, keyGenerator: 'user' });

router.get('/domains', ctrl.listDomains);
router.get('/', ctrl.listLifeAreas);
router.post('/', writeRateLimiter, validate(createLifeAreaSchema), ctrl.createLifeArea);

router.get('/:id', validateUuidParams, ctrl.getLifeArea);
router.patch('/:id', validateUuidParams, writeRateLimiter, validate(updateLifeAreaSchema), ctrl.updateLifeArea);
router.delete('/:id', validateUuidParams, writeRateLimiter, ctrl.archiveLifeArea);
router.post('/:id/links', validateUuidParams, writeRateLimiter, validate(linkEntitySchema), ctrl.linkEntity);

export default router;
