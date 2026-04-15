/**
 * Contact Routes (Public)
 * Public routes for contact form submissions
 */

import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware.js';
import { createContactSchema } from '../validators/contact.validator.js';
import { createContactSubmission } from '../controllers/contact.controller.js';

const router = Router();

/**
 * Submit contact form (public)
 * POST /api/contact
 */
router.post('/', validate(createContactSchema), createContactSubmission);

export default router;
