/**
 * @file Knowledge Graph Routes
 * @description API routes for the Knowledge Graph visualization
 * Mounted at /api/v1/intelligence/graph
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { knowledgeGraphController } from '../controllers/knowledge-graph.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Graph data
router.get('/', knowledgeGraphController.getGraph);

// Node detail
router.get('/node/:nodeId', knowledgeGraphController.getNodeDetail);

// Search
router.post('/search', knowledgeGraphController.searchNodes);

// Export
router.get('/export', knowledgeGraphController.exportGraph);

export default router;
