/**
 * Public Testimonial Routes
 * Public routes for fetching active testimonials (no auth required)
 */

import { Router } from 'express';
import { getPublicTestimonials_handler } from '../controllers/admin-testimonial.controller.js';

const router = Router();

// Get active testimonials for public display
// GET /api/testimonials
router.get('/', getPublicTestimonials_handler);

export default router;
