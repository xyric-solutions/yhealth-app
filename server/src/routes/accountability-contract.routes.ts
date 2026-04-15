import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createContractSchema,
  updateContractSchema,
  signContractSchema,
  cancelContractSchema,
  disputeViolationSchema,
  contractIdParamSchema,
  violationIdParamSchema,
  listContractsQuerySchema,
} from '../validators/accountability-contract.validator.js';
import controller from '../controllers/accountability-contract.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── CRUD ────────────────────────────────────────────────────────────

router.post('/', validate(createContractSchema), controller.createContract);
router.get('/', validate(listContractsQuerySchema, 'query'), controller.getContracts);
router.get('/stats', controller.getContractStats);
router.get('/suggestions', controller.getSuggestions);
router.get('/:id', validate(contractIdParamSchema, 'params'), controller.getContract);
router.put('/:id', validate(contractIdParamSchema, 'params'), validate(updateContractSchema), controller.updateContract);

// ─── LIFECYCLE ───────────────────────────────────────────────────────

router.post('/:id/sign', validate(contractIdParamSchema, 'params'), validate(signContractSchema), controller.signContract);
router.post('/:id/pause', validate(contractIdParamSchema, 'params'), controller.pauseContract);
router.post('/:id/resume', validate(contractIdParamSchema, 'params'), controller.resumeContract);
router.post('/:id/cancel', validate(contractIdParamSchema, 'params'), validate(cancelContractSchema), controller.cancelContract);

// ─── VIOLATIONS & CHECKS ────────────────────────────────────────────

router.get('/:id/violations', validate(contractIdParamSchema, 'params'), controller.getViolations);
router.get('/:id/checks', validate(contractIdParamSchema, 'params'), controller.getChecks);
router.post('/violations/:vid/dispute', validate(violationIdParamSchema, 'params'), validate(disputeViolationSchema), controller.disputeViolation);

export default router;
