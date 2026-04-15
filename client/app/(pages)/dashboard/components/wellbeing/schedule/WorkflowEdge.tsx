/**
 * @file WorkflowEdge Component
 * @description Clean edge component with hover delete for React Flow
 */

"use client";

import { memo, useState, useMemo } from "react";
import {
  type EdgeProps,
  getSmoothStepPath,
  EdgeLabelRenderer,
  useReactFlow,
} from "@xyflow/react";
import { X } from "lucide-react";

export interface WorkflowEdgeData {
  linkId?: string;
  onDelete?: (linkId: string) => void;
  linkType?: "sequential" | "conditional" | "parallel";
}

/* ─────────── Edge Colors ─────────── */

const EDGE_COLORS: Record<string, string> = {
  sequential: "#10b981",
  conditional: "#f59e0b",
  parallel: "#8b5cf6",
};

/* ─────────── Component ─────────── */

function WorkflowEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    selected,
    data,
    markerEnd,
    source,
    target,
  } = props;

  const edgeData = data as WorkflowEdgeData | undefined;
  const [isHovered, setIsHovered] = useState(false);
  const { linkId, onDelete, linkType = "sequential" } = edgeData || {};
  const { getNodes } = useReactFlow();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const color = EDGE_COLORS[linkType] || EDGE_COLORS.sequential;
  const isActive = selected || isHovered;
  const strokeOpacity = isActive ? 1 : 0.45;
  const strokeWidth = isActive ? 2.5 : 1.5;

  // Show delete button near selected/connected node
  const deletePos = useMemo(() => {
    if (!isActive) return null;

    const nodes = getNodes();
    const sourceNode = nodes.find((n) => n.id === source);
    const targetNode = nodes.find((n) => n.id === target);

    if (selected || sourceNode?.selected || targetNode?.selected) {
      return { x: labelX, y: labelY };
    }

    if (isHovered) {
      return { x: labelX, y: labelY };
    }

    return null;
  }, [
    isActive,
    selected,
    isHovered,
    source,
    target,
    labelX,
    labelY,
    getNodes,
  ]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (linkId && onDelete) {
      onDelete(linkId);
    }
  };

  return (
    <>
      {/* Main Edge */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={isActive ? "0" : "6,4"}
        style={{
          ...style,
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        markerEnd={markerEnd}
      />

      {/* Interaction overlay */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Delete button */}
      {deletePos && linkId && onDelete && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${deletePos.x}px,${deletePos.y}px)`,
              pointerEvents: "all",
            }}
          >
            <button
              onClick={handleDelete}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded-full flex items-center justify-center bg-red-500/90 hover:bg-red-500 text-white transition-colors shadow-lg"
              style={{
                boxShadow: "0 2px 8px rgba(239, 68, 68, 0.4)",
              }}
              title="Delete connection"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Flow particle on selection */}
      {selected && (
        <circle
          r="3"
          fill={color}
          style={{
            pointerEvents: "none",
            filter: `drop-shadow(0 0 3px ${color})`,
          }}
        >
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}
    </>
  );
}

export default memo(WorkflowEdge);
