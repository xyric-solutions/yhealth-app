'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { useKnowledgeGraph } from './hooks/useKnowledgeGraph';
import { FilterSidebar } from './components/FilterSidebar';
import { GraphHeader } from './components/GraphHeader';
import { TimelineView } from './components/TimelineView';
import { CardsView } from './components/CardsView';
import { GraphLegend } from './components/GraphLegend';
import { NodeTooltip } from './components/NodeTooltip';
import { NodeDetailModal } from './components/NodeDetailModal';
import { EmptyGraph } from './components/EmptyGraph';
import { GraphLoadingSkeleton } from './components/GraphLoadingSkeleton';
import { buildD3Graph, type D3Node } from './utils/graph-builder';
import type { GraphNode } from '@shared/types/domain/knowledge-graph';

const D3ForceGraph = dynamic(
  () => import('./components/D3ForceGraph').then((m) => m.D3ForceGraph),
  { ssr: false, loading: () => <GraphLoadingSkeleton /> }
);

type ViewMode = 'graph' | 'timeline' | 'cards';

export function KnowledgeGraphTab() {
  const {
    graphData,
    isLoading,
    error,
    filters,
    updateDateRange,
    toggleCategory,
    setSearchQuery,
    setDatePreset,
    hoveredNodeId,
    hoverNode,
    refetch,
  } = useKnowledgeGraph();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<D3Node | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredNodeData, setHoveredNodeData] = useState<D3Node | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // Default to collapsed on mobile
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setLeftPanelOpen(false);
    }
  }, []);

  // Build D3 graph for node lookups (navigation)
  const d3Graph = useMemo(() => {
    if (!graphData) return null;
    return buildD3Graph(graphData);
  }, [graphData]);

  const navigableNodeIds = useMemo(() => {
    if (!d3Graph) return [];
    return d3Graph.nodes.map((n) => n.id);
  }, [d3Graph]);

  const currentIndex = useMemo(() => {
    if (!selectedNodeId) return 0;
    const idx = navigableNodeIds.indexOf(selectedNodeId);
    return idx >= 0 ? idx : 0;
  }, [selectedNodeId, navigableNodeIds]);

  const handlePrev = useCallback(() => {
    if (!d3Graph || d3Graph.nodes.length <= 1) return;
    const prev = currentIndex <= 0 ? d3Graph.nodes.length - 1 : currentIndex - 1;
    const node = d3Graph.nodes[prev];
    setSelectedNodeId(node.id);
    setSelectedNodeData(node);
  }, [d3Graph, currentIndex]);

  const handleNext = useCallback(() => {
    if (!d3Graph || d3Graph.nodes.length <= 1) return;
    const next = currentIndex >= d3Graph.nodes.length - 1 ? 0 : currentIndex + 1;
    const node = d3Graph.nodes[next];
    setSelectedNodeId(node.id);
    setSelectedNodeData(node);
  }, [d3Graph, currentIndex]);

  const handleNodeClick = useCallback((nodeId: string, node: D3Node) => {
    setSelectedNodeId(nodeId);
    setSelectedNodeData(node);
  }, []);

  const handleNodeHover = useCallback(
    (nodeId: string | null, position?: { x: number; y: number }, node?: D3Node) => {
      hoverNode(nodeId);
      setTooltipPosition(position ?? null);
      setHoveredNodeData(node ?? null);
    },
    [hoverNode]
  );

  const handleCloseModal = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeData(null);
  }, []);

  // Handle node selection from timeline/cards views
  const handleViewNodeSelect = useCallback(
    (node: GraphNode) => {
      // Find the matching D3Node if possible, otherwise build a synthetic one
      const d3Node = d3Graph?.nodes.find(
        (n) =>
          n.entries.some((e) => e.id === node.id) ||
          n.id === node.id
      );

      if (d3Node) {
        setSelectedNodeId(d3Node.id);
        setSelectedNodeData(d3Node);
      } else {
        // Build a minimal D3Node-compatible object from the raw GraphNode
        const syntheticD3Node: D3Node = {
          id: node.id,
          label: node.label,
          category: node.category,
          nodeKind: 'daily',
          r: 10,
          color: '#94A3B8',
          entries: [node],
          entryCount: 1,
          date: node.date,
          forceLabel: false,
        };
        setSelectedNodeId(node.id);
        setSelectedNodeData(syntheticD3Node);
      }
    },
    [d3Graph]
  );

  const hasData = graphData && graphData.nodes.length > 0;

  // Build the graph area (used both normal and fullscreen)
  const graphArea = hasData ? (
    <D3ForceGraph
      data={graphData!}
      selectedNodeId={selectedNodeId}
      onNodeClick={handleNodeClick}
      onNodeHover={handleNodeHover}
      isFullscreen={isFullscreen}
      onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
    />
  ) : null;

  // Fullscreen overlay for graph view
  if (isFullscreen && viewMode === 'graph') {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 bg-[#0a0a12]"
        >
          <div className="w-full h-full">{graphArea}</div>
        </motion.div>
        {selectedNodeData && (
          <NodeDetailModal
            nodeAttrs={{
              label: selectedNodeData.label,
              category: selectedNodeData.category,
              nodeKind: selectedNodeData.nodeKind,
              entryCount: selectedNodeData.entryCount,
              entries: selectedNodeData.entries,
              date: selectedNodeData.date,
            }}
            nodeId={selectedNodeId}
            onClose={handleCloseModal}
            onPrev={handlePrev}
            onNext={handleNext}
            currentIndex={currentIndex}
            totalNodes={navigableNodeIds.length}
          />
        )}
      </>
    );
  }

  const content = (
    <div className="flex h-[calc(100vh-120px)] bg-[#02000f] rounded-2xl overflow-hidden border border-white/[0.06]">
      {/* Left: FilterSidebar */}
      <FilterSidebar
        filters={filters}
        onDatePreset={setDatePreset}
        onToggleCategory={toggleCategory}
        onDateRangeChange={updateDateRange}
        onSearchChange={setSearchQuery}
        categoryStats={graphData?.meta?.stats?.nodeCountByCategory || {}}
        isOpen={leftPanelOpen}
        onToggle={() => setLeftPanelOpen(!leftPanelOpen)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header bar */}
        <GraphHeader
          totalNodes={graphData?.meta?.stats?.totalNodes || 0}
          totalEdges={graphData?.meta?.stats?.totalEdges || 0}
          dateRange={{ from: filters.from, to: filters.to }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={refetch}
          isLoading={isLoading}
        />

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-3 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Failed to load graph: {error.message}</span>
          </motion.div>
        )}

        {/* View content */}
        <div className="flex-1 relative overflow-hidden" ref={graphContainerRef}>
          {isLoading ? (
            <GraphLoadingSkeleton />
          ) : !hasData ? (
            <EmptyGraph />
          ) : (
            <>
              {viewMode === 'graph' && (
                <>
                  {graphArea}
                  <GraphLegend />
                </>
              )}
              {viewMode === 'timeline' && (
                <TimelineView
                  nodes={graphData?.nodes || []}
                  onSelectNode={handleViewNodeSelect}
                  selectedNodeId={selectedNodeId}
                />
              )}
              {viewMode === 'cards' && (
                <CardsView
                  nodes={graphData?.nodes || []}
                  onSelectNode={handleViewNodeSelect}
                  selectedNodeId={selectedNodeId}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Tooltip (graph view only) */}
      {viewMode === 'graph' && (
        <NodeTooltip
          node={
            hoveredNodeData
              ? {
                  label: hoveredNodeData.label,
                  category: hoveredNodeData.category,
                  nodeKind: hoveredNodeData.nodeKind,
                  entryCount: hoveredNodeData.entryCount,
                  date: hoveredNodeData.date,
                }
              : null
          }
          position={tooltipPosition}
          containerRef={graphContainerRef}
        />
      )}

    </div>
  );

  // Render modal via portal-like pattern — OUTSIDE the overflow-hidden container
  return (
    <>
      {content}
      {selectedNodeData && (
        <NodeDetailModal
          nodeAttrs={{
            label: selectedNodeData.label,
            category: selectedNodeData.category,
            nodeKind: selectedNodeData.nodeKind,
            entryCount: selectedNodeData.entryCount,
            entries: selectedNodeData.entries,
            date: selectedNodeData.date,
          }}
          nodeId={selectedNodeId}
          onClose={handleCloseModal}
          onPrev={handlePrev}
          onNext={handleNext}
          currentIndex={currentIndex}
          totalNodes={navigableNodeIds.length}
        />
      )}
    </>
  );
}
