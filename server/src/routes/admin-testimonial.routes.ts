/**
 * Admin Testimonial Routes
 * Admin-only routes for testimonial/review management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createTestimonialSchema,
  updateTestimonialSchema,
  bulkDeleteTestimonialsSchema,
  bulkToggleActiveTestimonialsSchema,
} from '../validators/admin-testimonial.validator.js';
import {
  getAdminTestimonials,
  getAdminTestimonialStats,
  getAdminTestimonialById_handler,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  bulkDeleteTestimonials,
  bulkToggleActiveTestimonials,
  toggleTestimonialActive,
  toggleTestimonialFeatured,
} from '../controllers/admin-testimonial.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// List testimonials (admin — includes inactive)
// GET /api/admin/testimonials
router.get('/', getAdminTestimonials);

// Get testimonial stats
// GET /api/admin/testimonials/stats
router.get('/stats', getAdminTestimonialStats);

// Create testimonial
// POST /api/admin/testimonials
router.post('/', validate(createTestimonialSchema), createTestimonial);

// Bulk delete testimonials
// POST /api/admin/testimonials/bulk-delete
router.post('/bulk-delete', validate(bulkDeleteTestimonialsSchema), bulkDeleteTestimonials);

// Bulk toggle active status
// POST /api/admin/testimonials/bulk-toggle-active
router.post('/bulk-toggle-active', validate(bulkToggleActiveTestimonialsSchema), bulkToggleActiveTestimonials);

// Get single testimonial
// GET /api/admin/testimonials/:id
router.get('/:id', getAdminTestimonialById_handler);

// Update testimonial
// PUT /api/admin/testimonials/:id
router.put('/:id', validate(updateTestimonialSchema), updateTestimonial);
router.patch('/:id', validate(updateTestimonialSchema), updateTestimonial);

// Delete testimonial
// DELETE /api/admin/testimonials/:id
router.delete('/:id', deleteTestimonial);

// Toggle active status
// POST /api/admin/testimonials/:id/toggle-active
router.post('/:id/toggle-active', toggleTestimonialActive);

// Toggle featured status
// POST /api/admin/testimonials/:id/toggle-featured
router.post('/:id/toggle-featured', toggleTestimonialFeatured);

export default router;
