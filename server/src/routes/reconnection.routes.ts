import { Router } from 'express';
import { reconnectionController } from '../controllers/reconnection.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authenticate, reconnectionController.list);
router.get('/:id', authenticate, reconnectionController.getOne);
router.post('/:id/respond', authenticate, reconnectionController.respond);
router.post('/:id/dismiss', authenticate, reconnectionController.dismiss);

export default router;
