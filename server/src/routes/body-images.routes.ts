/**
 * @file Body Images Routes
 * @description Routes for body image upload and analysis during onboarding
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { uploadImage } from '../middlewares/upload.middleware.js';
import {
  uploadBodyImage,
  analyzeBodyImage,
  getBodyImages,
  deleteBodyImage,
  analyzeAllBodyImages,
} from '../controllers/body-images.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Upload body image
router.post(
  '/upload',
  uploadImage,
  uploadBodyImage
);

// Get user's body images
router.get(
  '/',
  getBodyImages
);

// Analyze specific body image
router.post(
  '/:imageId/analyze',
  analyzeBodyImage
);

// Delete body image
router.delete(
  '/:imageId',
  deleteBodyImage
);

// Batch analyze all pending images
router.post(
  '/analyze-all',
  analyzeAllBodyImages
);

export default router;

