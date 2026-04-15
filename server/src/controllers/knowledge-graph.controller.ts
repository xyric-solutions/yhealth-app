/**
 * @file Knowledge Graph Controller
 * @description API endpoints for the Knowledge Graph visualization
 * Mounted at /api/v1/intelligence/graph
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { knowledgeGraphService } from '../services/knowledge-graph.service.js';
import type { GraphFilter, GraphNodeType } from '@shared/types/domain/knowledge-graph.js';

class KnowledgeGraphController {
  /**
   * @route   GET /api/v1/intelligence/graph
   * @desc    Get knowledge graph data with filters
   */
  getGraph = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
    const to = (req.query.to as string) || from;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      throw ApiError.badRequest('Invalid date format. Use YYYY-MM-DD');
    }

    const filter: GraphFilter = {
      dateRange: { from, to },
      categories: req.query.categories
        ? (req.query.categories as string).split(',').filter(Boolean) as GraphFilter['categories']
        : undefined,
      edgeCategories: req.query.edgeCategories
        ? (req.query.edgeCategories as string).split(',').filter(Boolean) as GraphFilter['edgeCategories']
        : undefined,
      minEdgeStrength: req.query.minEdgeStrength
        ? parseFloat(req.query.minEdgeStrength as string)
        : undefined,
      focusNodeId: req.query.focusNodeId as string | undefined,
      focusDepth: req.query.focusDepth
        ? Math.min(3, Math.max(1, parseInt(req.query.focusDepth as string)))
        : undefined,
      searchQuery: req.query.searchQuery as string | undefined,
      maxNodes: req.query.maxNodes
        ? Math.min(500, Math.max(10, parseInt(req.query.maxNodes as string)))
        : 200,
      includeAI: req.query.includeAI === 'true',
    };

    const graph = await knowledgeGraphService.buildGraph(userId, filter);
    ApiResponse.success(res, graph, 'Knowledge graph retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/intelligence/graph/node/:nodeId
   * @desc    Get detailed info for a specific node
   */
  getNodeDetail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { nodeId } = req.params;
    const nodeType = req.query.type as GraphNodeType;
    if (!nodeId || !nodeType) {
      throw ApiError.badRequest('nodeId and type query param are required');
    }

    const detail = await knowledgeGraphService.getNodeDetail(userId, nodeId, nodeType);
    if (!detail) {
      throw ApiError.notFound('Node not found');
    }
    ApiResponse.success(res, detail, 'Node detail retrieved', undefined, req);
  });

  /**
   * @route   POST /api/v1/intelligence/graph/search
   * @desc    Search for nodes by text query
   */
  searchNodes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { query: searchQuery, from, to } = req.body;
    if (!searchQuery || typeof searchQuery !== 'string') {
      throw ApiError.badRequest('query is required');
    }

    const today = new Date().toISOString().slice(0, 10);
    const dateRange = {
      from: from || today,
      to: to || today,
    };

    const nodes = await knowledgeGraphService.searchNodes(userId, searchQuery, dateRange);
    ApiResponse.success(res, { nodes }, 'Search results retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/intelligence/graph/export
   * @desc    Export graph data as JSON or CSV
   */
  exportGraph = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const format = (req.query.format as string) || 'json';
    const from = req.query.from as string;
    const to = req.query.to as string;

    if (!from || !to) {
      throw ApiError.badRequest('from and to date params are required');
    }

    const filter: GraphFilter = {
      dateRange: { from, to },
      maxNodes: 500,
    };

    const graph = await knowledgeGraphService.buildGraph(userId, filter);

    if (format === 'csv') {
      // Build CSV from nodes
      const headers = ['id', 'type', 'category', 'label', 'date', 'timestamp'];
      const rows = graph.nodes.map((n) =>
        [n.id, n.type, n.category, `"${n.label.replace(/"/g, '""')}"`, n.date, n.timestamp].join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="knowledge-graph-${from}-${to}.csv"`);
      res.send(csv);
      return;
    }

    // Default: JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="knowledge-graph-${from}-${to}.json"`);
    res.json(graph);
  });
}

export const knowledgeGraphController = new KnowledgeGraphController();
