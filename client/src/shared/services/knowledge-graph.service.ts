/**
 * @file Knowledge Graph API Service
 * @description Client-side API service for the Knowledge Graph visualization
 */

import { api, type ApiResponse } from '@/lib/api-client';
import type {
  KnowledgeGraphData,
  GraphNode,
  GraphEdge,
  GraphNodeCategory,
  EdgeCategory,
  GraphNodeType,
  GraphDateRange,
} from '@shared/types/domain/knowledge-graph';

const BASE = '/v1/intelligence/graph';

export interface GetGraphParams {
  from: string;
  to: string;
  categories?: GraphNodeCategory[];
  edgeCategories?: EdgeCategory[];
  minEdgeStrength?: number;
  focusNodeId?: string;
  focusDepth?: number;
  searchQuery?: string;
  maxNodes?: number;
  includeAI?: boolean;
}

export interface NodeDetailResult {
  node: GraphNode;
  neighbors: GraphNode[];
  edges: GraphEdge[];
}

export const knowledgeGraphService = {
  async getGraph(params: GetGraphParams): Promise<ApiResponse<KnowledgeGraphData>> {
    const queryParams: Record<string, string> = {
      from: params.from,
      to: params.to,
    };
    if (params.categories?.length) queryParams.categories = params.categories.join(',');
    if (params.edgeCategories?.length) queryParams.edgeCategories = params.edgeCategories.join(',');
    if (params.minEdgeStrength !== undefined) queryParams.minEdgeStrength = String(params.minEdgeStrength);
    if (params.focusNodeId) queryParams.focusNodeId = params.focusNodeId;
    if (params.focusDepth) queryParams.focusDepth = String(params.focusDepth);
    if (params.searchQuery) queryParams.searchQuery = params.searchQuery;
    if (params.maxNodes) queryParams.maxNodes = String(params.maxNodes);
    if (params.includeAI) queryParams.includeAI = 'true';

    return api.get(BASE, { params: queryParams });
  },

  async getNodeDetail(nodeId: string, nodeType: GraphNodeType): Promise<ApiResponse<NodeDetailResult>> {
    return api.get(`${BASE}/node/${nodeId}`, { params: { type: nodeType } });
  },

  async searchNodes(query: string, dateRange?: GraphDateRange): Promise<ApiResponse<{ nodes: GraphNode[] }>> {
    return api.post(`${BASE}/search`, {
      query,
      from: dateRange?.from,
      to: dateRange?.to,
    });
  },

  async exportGraph(format: 'json' | 'csv', from: string, to: string): Promise<ApiResponse<KnowledgeGraphData>> {
    return api.get(`${BASE}/export`, {
      params: { format, from, to },
    });
  },
};
