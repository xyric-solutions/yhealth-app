import { Router } from 'express';
import { youtubeController } from '../controllers/youtube.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/search', optionalAuth, youtubeController.search);

export default router;
