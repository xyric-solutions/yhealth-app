/**
 * Public Newsletter Routes
 * POST /api/newsletter/subscribe, GET /api/newsletter/count
 */

import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware.js';
import { subscribeNewsletterSchema } from '../validators/newsletter.validator.js';
import { subscribe, getCount } from '../controllers/newsletter.controller.js';

const router = Router();

router.post('/subscribe', validate(subscribeNewsletterSchema), subscribe);
router.get('/count', getCount);

export default router;
