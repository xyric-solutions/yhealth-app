import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { followRequestSchema, userIdParamSchema, followIdParamSchema, consentUpdateSchema } from '../validators/follow.validator.js';
import controller from '../controllers/follow.controller.js';

const router = Router();
router.use(authenticate);

// ─── Social Stats ────────────────────────────────────────────────────
router.get('/stats', controller.getSocialStats);

// ─── Buddy Suggestions ──────────────────────────────────────────────
router.get('/suggestions', controller.getSuggestions);
router.post('/suggestions/:userId/dismiss', validate(userIdParamSchema, 'params'), controller.dismissSuggestion);

// ─── Consent ─────────────────────────────────────────────────────────
router.get('/consent', controller.getConsent);
router.put('/consent', validate(consentUpdateSchema), controller.updateConsent);

// ─── Follow Lists ────────────────────────────────────────────────────
router.get('/followers', controller.getFollowers);
router.get('/following', controller.getFollowing);
router.get('/pending', controller.getPendingRequests);
router.get('/mutual', controller.getMutualFollows);

// ─── Relationship Check ─────────────────────────────────────────────
router.get('/relationship/:userId', validate(userIdParamSchema, 'params'), controller.getRelationship);

// ─── Follow Actions ──────────────────────────────────────────────────
router.post('/:userId', validate(userIdParamSchema, 'params'), validate(followRequestSchema), controller.sendFollowRequest);
router.post('/:followId/accept', validate(followIdParamSchema, 'params'), controller.acceptFollowRequest);
router.post('/:followId/reject', validate(followIdParamSchema, 'params'), controller.rejectFollowRequest);
router.delete('/:userId', validate(userIdParamSchema, 'params'), controller.removeFollow);
router.post('/:userId/block', validate(userIdParamSchema, 'params'), controller.blockUser);

export default router;
