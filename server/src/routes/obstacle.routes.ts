import { Router } from 'express';
import { obstacleController } from '../controllers/obstacle.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, obstacleController.list);
router.get('/:id', authenticate, obstacleController.getOne);
router.post('/:id/diagnose', authenticate, obstacleController.diagnose);
router.post('/:id/apply-adjustment', authenticate, obstacleController.applyAdjustment);
router.post('/:id/dismiss', authenticate, obstacleController.dismiss);

export default router;
