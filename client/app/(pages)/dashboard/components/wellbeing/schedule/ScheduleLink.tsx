/**
 * @file ScheduleLink Component
 * @description Visual link connector between schedule items (n8n-style)
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { ScheduleLink as ScheduleLinkType, ScheduleItem } from "@/src/shared/services/schedule.service";

interface ScheduleLinkProps {
  link: ScheduleLinkType;
  sourceItem: ScheduleItem;
  targetItem: ScheduleItem;
  onDelete: (linkId: string) => void;
  timelineHeight: number;
  startHour?: number;
}

export function ScheduleLink({
  link,
  sourceItem,
  targetItem,
  onDelete,
  timelineHeight,
  startHour = 0,
}: ScheduleLinkProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate positions
  const timeToPosition = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    const totalMinutes = (hours - startHour) * 60 + minutes;
    return (totalMinutes / ((24 - startHour) * 60)) * timelineHeight;
  };

  const getItemCenter = (item: ScheduleItem): number => {
    const top = timeToPosition(item.startTime);
    const duration = item.durationMinutes || 30;
    const height = (duration / ((24 - startHour) * 60)) * timelineHeight;
    return top + height / 2;
  };

  const sourceY = getItemCenter(sourceItem);
  const targetY = getItemCenter(targetItem);
  const sourceX = 100; // Right edge of timeline
  const targetX = 0; // Left edge of timeline

  // Calculate bezier curve control points
  const controlPoint1X = sourceX + 50;
  const controlPoint1Y = sourceY;
  const controlPoint2X = targetX - 50;
  const controlPoint2Y = targetY;

  const path = `M ${sourceX} ${sourceY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${targetX} ${targetY}`;

  // Calculate midpoint for delete button
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const linkColor = link.linkType === "conditional" ? "#f59e0b" : link.linkType === "parallel" ? "#8b5cf6" : "#059669";

  return (
    <g>
      {/* Link path */}
      <motion.path
        d={path}
        fill="none"
        stroke={linkColor}
        strokeWidth={isHovered ? 3 : 2}
        strokeDasharray={link.linkType === "parallel" ? "5,5" : "0"}
        opacity={isHovered ? 1 : 0.7}
        className="cursor-pointer transition-all"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onDelete(link.id)}
      />

      {/* Arrow head */}
      <motion.polygon
        points={`${targetX - 5},${targetY - 3} ${targetX},${targetY} ${targetX - 5},${targetY + 3}`}
        fill={linkColor}
        opacity={isHovered ? 1 : 0.7}
        className="cursor-pointer transition-opacity"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onDelete(link.id)}
      />

      {/* Delete button (appears on hover) */}
      {isHovered && (
        <motion.g
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="cursor-pointer"
          onClick={() => onDelete(link.id)}
        >
          <circle cx={midX} cy={midY} r="12" fill="#1e293b" stroke={linkColor} strokeWidth="2" />
          <X
            x={midX}
            y={midY}
            className="w-3 h-3 text-white"
            style={{ transform: "translate(-6px, -6px)" }}
          />
        </motion.g>
      )}

      {/* Delay label */}
      {link.delayMinutes > 0 && (
        <motion.text
          x={midX}
          y={midY - 10}
          fill={linkColor}
          fontSize="10"
          textAnchor="middle"
          className="pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0.5 }}
        >
          +{link.delayMinutes}m
        </motion.text>
      )}
    </g>
  );
}


