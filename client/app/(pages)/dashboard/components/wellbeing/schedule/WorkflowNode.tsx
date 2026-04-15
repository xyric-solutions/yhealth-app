/**
 * @file WorkflowNode Component
 * @description Clean n8n-style node card for React Flow schedule workflow
 */

"use client";

import React, { useCallback, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Edit2, Trash2, Clock, GripVertical } from "lucide-react";
import type { ScheduleItem } from "@/src/shared/services/schedule.service";

/* ─────────── Helpers ─────────── */

const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const formatTime12h = (time: string): string => {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time;
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours >= 12 ? "PM" : "AM";
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
};

const getDuration = (
  startTime: string,
  endTime?: string,
  durationMinutes?: number
): string | null => {
  let mins = durationMinutes || 0;
  if (endTime) {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const diff = toMin(endTime) - toMin(startTime);
    if (diff > 0) mins = diff;
  }
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

/* ─────────── Types ─────────── */

export interface WorkflowNodeData {
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  onDelete: () => void;
  connectionCount: number;
}

/* ─────────── Component ─────────── */

function WorkflowNode(props: NodeProps): React.JSX.Element {
  const { data, selected } = props;
  const nodeData = data as unknown as WorkflowNodeData;
  const { item, onEdit, onDelete, connectionCount } = nodeData;
  const [isHovered, setIsHovered] = useState(false);

  const handleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit(item);
    },
    [item, onEdit]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete();
    },
    [onDelete]
  );

  const duration = getDuration(
    item.startTime,
    item.endTime,
    item.durationMinutes
  );
  const color = item.color || "#10b981";
  const showActions = isHovered || selected;

  return (
    <div
      className="group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          background: color,
          border: "2px solid rgba(13, 13, 20, 0.8)",
          boxShadow: selected ? `0 0 6px ${hexToRgba(color, 0.6)}` : "none",
          transition: "all 0.15s ease",
        }}
      />

      {/* Node Card */}
      <div
        className="relative rounded-xl overflow-hidden transition-all duration-150"
        style={{
          width: 240,
          background: "rgba(20, 20, 30, 0.92)",
          backdropFilter: "blur(8px)",
          border: `1.5px solid ${selected ? hexToRgba(color, 0.7) : "rgba(255, 255, 255, 0.08)"}`,
          boxShadow: selected
            ? `0 0 0 1px ${hexToRgba(color, 0.15)}, 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px ${hexToRgba(color, 0.12)}`
            : isHovered
              ? "0 8px 24px rgba(0, 0, 0, 0.4)"
              : "0 2px 12px rgba(0, 0, 0, 0.3)",
          transform: isHovered ? "translateY(-1px)" : "none",
        }}
      >
        {/* Color accent bar */}
        <div
          className="h-[3px] w-full"
          style={{ background: color }}
        />

        {/* Content */}
        <div className="px-3.5 py-3">
          {/* Header row */}
          <div className="flex items-start gap-2.5 mb-2">
            {/* Icon */}
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: hexToRgba(color, 0.12),
                border: `1px solid ${hexToRgba(color, 0.2)}`,
              }}
            >
              {item.icon ? (
                <span className="text-base leading-none">{item.icon}</span>
              ) : (
                <GripVertical
                  className="w-4 h-4"
                  style={{ color: hexToRgba(color, 0.8) }}
                />
              )}
            </div>

            {/* Title & Category */}
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-semibold text-white leading-tight truncate">
                {item.title}
              </h3>
              {item.category && (
                <span
                  className="text-[10px] font-medium leading-tight"
                  style={{ color: hexToRgba(color, 0.9) }}
                >
                  {item.category}
                </span>
              )}
            </div>

            {/* Connection badge */}
            {connectionCount > 0 && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: hexToRgba(color, 0.15),
                  border: `1px solid ${hexToRgba(color, 0.3)}`,
                }}
              >
                <span
                  className="text-[9px] font-bold"
                  style={{ color: hexToRgba(color, 0.9) }}
                >
                  {connectionCount}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
              {item.description}
            </p>
          )}

          {/* Footer: Time + Duration */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="w-3 h-3 shrink-0" />
              <span className="font-medium">
                {formatTime12h(item.startTime)}
              </span>
              {item.endTime && (
                <>
                  <span className="text-slate-600">-</span>
                  <span className="font-medium">
                    {formatTime12h(item.endTime)}
                  </span>
                </>
              )}
            </div>
            {duration && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{
                  background: hexToRgba(color, 0.12),
                  color: hexToRgba(color, 0.9),
                }}
              >
                {duration}
              </span>
            )}
          </div>
        </div>

        {/* Hover Actions Overlay */}
        {showActions && (
          <div className="absolute top-[3px] right-0 flex gap-1 p-1.5 z-30">
            <button
              onClick={handleEdit}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={handleDelete}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10,
          height: 10,
          background: color,
          border: "2px solid rgba(13, 13, 20, 0.8)",
          boxShadow: selected ? `0 0 6px ${hexToRgba(color, 0.6)}` : "none",
          transition: "all 0.15s ease",
        }}
      />
    </div>
  );
}

export default WorkflowNode;
