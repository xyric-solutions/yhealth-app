/**
 * @file ScheduleWorkflow Component
 * @description n8n-style React Flow canvas for schedule workflow visualization
 */

"use client";

import { useCallback, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  ConnectionLineType,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import WorkflowNode, { type WorkflowNodeData } from "./WorkflowNode";
import WorkflowEdge, { type WorkflowEdgeData } from "./WorkflowEdge";
import type {
  DailySchedule,
  ScheduleItem,
} from "@/src/shared/services/schedule.service";

/* ─────────── Helpers ─────────── */

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const getEndTime = (item: ScheduleItem): number => {
  const startMinutes = timeToMinutes(item.startTime);
  if (item.endTime) return timeToMinutes(item.endTime);
  if (item.durationMinutes) return startMinutes + item.durationMinutes;
  return startMinutes + 30;
};

/* ─────────── Types ─────────── */

interface ScheduleWorkflowProps {
  schedule: DailySchedule;
  onNodeEdit: (item: ScheduleItem) => void;
  onNodeDelete: (item: ScheduleItem) => void;
  onNodeCreate?: (position: { x: number; y: number }) => Promise<void>;
  onNodePositionChange: (
    itemId: string,
    position: { x: number; y: number }
  ) => void;
  onEdgeCreate: (sourceId: string, targetId: string) => Promise<void>;
  onEdgeDelete: (linkId: string) => Promise<void>;
  onAutoConnect?: () => Promise<void>;
}

const nodeTypes = {
  workflow: WorkflowNode as unknown,
} as NodeTypes;

const edgeTypes = {
  workflow: WorkflowEdge as unknown,
} as EdgeTypes;

/* ─────────── Canvas Content ─────────── */

function ScheduleWorkflowContent({
  schedule,
  onNodeEdit,
  onNodeDelete,
  onNodeCreate,
  onNodePositionChange,
  onEdgeCreate,
  onEdgeDelete,
  onAutoConnect,
}: ScheduleWorkflowProps) {
  const calculateTimeBasedPosition = useCallback(
    (item: ScheduleItem): { x: number; y: number } => {
      // Saved position from metadata takes priority
      const metadata = item.metadata as
        | { x?: number; y?: number }
        | undefined;
      if (
        metadata &&
        typeof metadata.x === "number" &&
        typeof metadata.y === "number"
      ) {
        if (
          isFinite(metadata.x) &&
          isFinite(metadata.y) &&
          metadata.x >= 0 &&
          metadata.y >= 0
        ) {
          return { x: metadata.x, y: metadata.y };
        }
      }

      // Time-based fallback
      const allTimes = schedule.items.flatMap((i) => {
        const start = timeToMinutes(i.startTime);
        const end = getEndTime(i);
        return [start, end];
      });
      const minTime = Math.min(...allTimes);
      const maxTime = Math.max(...allTimes);
      const timeRange = maxTime - minTime || 1;

      const startMinutes = timeToMinutes(item.startTime);
      const timeProgress = (startMinutes - minTime) / timeRange;
      const canvasWidth = 1400;
      const x = 150 + timeProgress * canvasWidth;

      // Vertical grouping for overlapping items
      const overlappingGroups: ScheduleItem[][] = [];
      const processed = new Set<string>();

      schedule.items.forEach((currentItem) => {
        if (processed.has(currentItem.id)) return;

        const currentStart = timeToMinutes(currentItem.startTime);
        const currentEnd = getEndTime(currentItem);
        const group = [currentItem];
        processed.add(currentItem.id);

        schedule.items.forEach((otherItem) => {
          if (processed.has(otherItem.id)) return;
          const otherStart = timeToMinutes(otherItem.startTime);
          const otherEnd = getEndTime(otherItem);

          if (
            (otherStart >= currentStart && otherStart < currentEnd) ||
            (otherEnd > currentStart && otherEnd <= currentEnd) ||
            (otherStart <= currentStart && otherEnd >= currentEnd)
          ) {
            group.push(otherItem);
            processed.add(otherItem.id);
          }
        });

        overlappingGroups.push(group);
      });

      const itemGroup = overlappingGroups.find((group) =>
        group.some((i) => i.id === item.id)
      );
      const groupIndex = overlappingGroups.indexOf(itemGroup || []);
      const itemIndexInGroup =
        itemGroup?.findIndex((i) => i.id === item.id) || 0;

      const ySpacing = 200;
      const y = 150 + groupIndex * ySpacing + itemIndexInGroup * 180;

      return { x, y };
    },
    [schedule]
  );

  const nodeDefaults = {
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };

  // Convert items to nodes
  const initialNodes = useMemo(() => {
    return schedule.items.map((item) => {
      const position = calculateTimeBasedPosition(item);
      const connectionCount = schedule.links.filter(
        (link) =>
          link.sourceItemId === item.id || link.targetItemId === item.id
      ).length;

      return {
        id: item.id,
        type: "workflow",
        position,
        ...nodeDefaults,
        data: {
          item,
          onEdit: onNodeEdit,
          onDelete: () => onNodeDelete(item),
          connectionCount,
        },
      } as Node;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    schedule.items,
    schedule.links,
    calculateTimeBasedPosition,
    onNodeEdit,
    onNodeDelete,
  ]);

  // Convert links to edges
  const initialEdges = useMemo(() => {
    return schedule.links.map((link) => ({
      id: link.id,
      source: link.sourceItemId,
      target: link.targetItemId,
      type: "workflow",
      animated: true,
      data: {
        linkId: link.id,
        onDelete: async (linkId: string) => {
          await onEdgeDelete(linkId);
        },
        linkType: link.linkType,
      },
    })) as Edge[];
  }, [schedule.links, onEdgeDelete]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes with schedule
  useEffect(() => {
    const itemIds = new Set(schedule.items.map((i) => i.id));

    setNodes((currentNodes) => {
      const nodesToKeep = currentNodes.filter((node) => itemIds.has(node.id));

      return schedule.items.map((item) => {
        const existingNode = nodesToKeep.find((n) => n.id === item.id);
        const savedPosition = calculateTimeBasedPosition(item);
        const position =
          savedPosition || existingNode?.position || { x: 100, y: 100 };
        const connectionCount = schedule.links.filter(
          (link) =>
            link.sourceItemId === item.id || link.targetItemId === item.id
        ).length;

        return {
          id: item.id,
          type: "workflow",
          position,
          ...nodeDefaults,
          data: {
            item,
            onEdit: onNodeEdit,
            onDelete: () => onNodeDelete(item),
            connectionCount,
          },
        } as Node;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    schedule.items,
    schedule.links,
    calculateTimeBasedPosition,
    onNodeEdit,
    onNodeDelete,
    setNodes,
  ]);

  // Sync edges with schedule
  useEffect(() => {
    const itemIds = new Set(schedule.items.map((i) => i.id));

    const validLinks = schedule.links.filter(
      (link) =>
        itemIds.has(link.sourceItemId) && itemIds.has(link.targetItemId)
    );

    const newEdges = validLinks.map((link) => ({
      id: link.id,
      source: link.sourceItemId,
      target: link.targetItemId,
      type: "workflow",
      animated: true,
      data: {
        linkId: link.id,
        onDelete: async (linkId: string) => {
          await onEdgeDelete(linkId);
        },
        linkType: link.linkType,
      },
    })) as Edge[];

    setEdges(newEdges);
  }, [schedule.items, schedule.links, onEdgeDelete, setEdges]);

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodePositionChange(node.id, {
        x: node.position.x,
        y: node.position.y,
      });
    },
    [onNodePositionChange]
  );

  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;
      const edgeExists = edges.some(
        (e) => e.source === params.source && e.target === params.target
      );
      if (edgeExists) return;
      setEdges((eds) => addEdge(params, eds));
      await onEdgeCreate(params.source, params.target);
    },
    [edges, setEdges, onEdgeCreate]
  );

  const onNodesDelete = useCallback(async (deletedNodes: Node[]) => {
    for (const node of deletedNodes) {
      const nodeData = node.data as unknown as WorkflowNodeData | undefined;
      if (nodeData?.item && nodeData?.onDelete) {
        nodeData.onDelete();
      }
    }
  }, []);

  const onEdgesDelete = useCallback(async (deletedEdges: Edge[]) => {
    for (const edge of deletedEdges) {
      const edgeData = edge.data as WorkflowEdgeData | undefined;
      if (edgeData?.linkId && edgeData?.onDelete) {
        await edgeData.onDelete(edgeData.linkId);
      }
    }
  }, []);

  const onPaneClick = useCallback(
    async (event: React.MouseEvent) => {
      if (event.detail === 2 && onNodeCreate) {
        const reactFlowBounds = (
          event.currentTarget as HTMLElement
        ).getBoundingClientRect();
        const position = {
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        };
        await onNodeCreate(position);
      }
    },
    [onNodeCreate]
  );

  // Auto-connect on initial mount only
  const autoConnectRanRef = useRef(false);
  const lastScheduleDateRef = useRef(schedule.scheduleDate);

  useEffect(() => {
    if (schedule.scheduleDate !== lastScheduleDateRef.current) {
      autoConnectRanRef.current = false;
      lastScheduleDateRef.current = schedule.scheduleDate;
    }
  }, [schedule.scheduleDate]);

  useEffect(() => {
    if (
      onAutoConnect &&
      !autoConnectRanRef.current &&
      schedule.items.length > 0
    ) {
      autoConnectRanRef.current = true;
      onAutoConnect();
    }
  }, [onAutoConnect, schedule.items.length]);

  return (
    <div className="absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={2.5}
        defaultEdgeOptions={{
          animated: true,
          selectable: true,
          style: {
            strokeWidth: 2,
            stroke: "#10b981",
          },
        }}
        connectionLineStyle={{
          stroke: "#10b981",
          strokeWidth: 2.5,
          strokeDasharray: "8,4",
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
        snapToGrid={true}
        snapGrid={[20, 20]}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255,255,255,0.08)"
        />

        {/* Controls - bottom-left */}
        <Controls
          style={{
            background: "rgba(13, 13, 20, 0.9)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "10px",
            padding: "4px",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
          }}
          showInteractive={false}
        />

        {/* Minimap - bottom-right */}
        <MiniMap
          nodeColor={(node) => {
            const item = (node.data as { item: ScheduleItem })?.item;
            return item?.color || "#10b981";
          }}
          maskColor="rgba(0, 0, 0, 0.8)"
          style={{
            background: "rgba(13, 13, 20, 0.9)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: "10px",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.4)",
          }}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

/* ─────────── Exported Wrapper ─────────── */

export default function ScheduleWorkflow(props: ScheduleWorkflowProps) {
  return (
    <ReactFlowProvider>
      <ScheduleWorkflowContent {...props} />
    </ReactFlowProvider>
  );
}
