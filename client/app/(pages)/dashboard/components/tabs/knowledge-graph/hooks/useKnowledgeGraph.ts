'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { knowledgeGraphService, type GetGraphParams } from '@/src/shared/services/knowledge-graph.service';
import type { GraphNodeCategory, EdgeCategory, KnowledgeGraphData } from '@shared/types/domain/knowledge-graph';
import { DEFAULT_MAX_NODES } from '../constants/graph-config';

export interface GraphFilterState {
  from: string;
  to: string;
  categories: GraphNodeCategory[];
  edgeCategories: EdgeCategory[];
  searchQuery: string;
  maxNodes: number;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useKnowledgeGraph() {
  const today = getToday();

  const [filters, setFilters] = useState<GraphFilterState>({
    from: today,
    to: today,
    categories: [],
    edgeCategories: [],
    searchQuery: '',
    maxNodes: DEFAULT_MAX_NODES,
  });

  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  // Fetch graph data when filters change
  useEffect(() => {
    const currentFetchId = ++fetchIdRef.current;

    const fetchGraph = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params: GetGraphParams = {
          from: filters.from,
          to: filters.to,
          categories: filters.categories.length > 0 ? filters.categories : undefined,
          edgeCategories: filters.edgeCategories.length > 0 ? filters.edgeCategories : undefined,
          searchQuery: filters.searchQuery || undefined,
          maxNodes: filters.maxNodes,
        };

        const response = await knowledgeGraphService.getGraph(params);

        // Stale request guard
        if (currentFetchId !== fetchIdRef.current) return;

        if (response.success && response.data) {
          setGraphData(response.data as KnowledgeGraphData);
        } else {
          setError(new Error(response.error?.message || 'Failed to fetch graph'));
        }
      } catch (err) {
        if (currentFetchId !== fetchIdRef.current) return;
        setError(err instanceof Error ? err : new Error('Failed to fetch graph'));
      } finally {
        if (currentFetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchGraph();
  }, [filters]);

  const refetch = useCallback(() => {
    // Trigger re-fetch by bumping a value in filters (identity change)
    setFilters((prev) => ({ ...prev }));
  }, []);

  const updateDateRange = useCallback((from: string, to: string) => {
    setFilters((prev) => ({ ...prev, from, to }));
    setSelectedNodeId(null);
  }, []);

  const toggleCategory = useCallback((category: GraphNodeCategory) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setDatePreset = useCallback((preset: 'day' | 'week' | 'month') => {
    const to = getToday();
    let from = to;
    if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      from = d.toISOString().slice(0, 10);
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      from = d.toISOString().slice(0, 10);
    }
    updateDateRange(from, to);
  }, [updateDateRange]);

  const selectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const hoverNode = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, []);

  return {
    // Data
    graphData,
    isLoading,
    error,

    // Filters
    filters,
    updateDateRange,
    toggleCategory,
    setSearchQuery,
    setDatePreset,

    // Interaction
    selectedNodeId,
    hoveredNodeId,
    selectNode,
    hoverNode,

    // Actions
    refetch,
  };
}
