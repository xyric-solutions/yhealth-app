import { Router } from 'express';
import {
  healthCheck,
  livenessProbe,
  readinessProbe,
  detailedHealthCheck,
  serverInfo,
  proactiveMessagingHealth,
  resetCircuitBreaker,
} from '../controllers/health.controller.js';

const router = Router();

// Basic health check - for load balancers
router.get('/', healthCheck);

// Kubernetes probes
router.get('/live', livenessProbe);
router.get('/ready', readinessProbe);

// Detailed health check - for monitoring
router.get('/detailed', detailedHealthCheck);

// Proactive messaging diagnostics
router.get('/proactive-messaging', proactiveMessagingHealth);

// Circuit breaker manual reset (admin)
router.post('/circuit-breaker/reset', resetCircuitBreaker);

// Server info - development only
router.get('/info', serverInfo);

export default router;
